#!/usr/bin/env python3
"""Suwappu natural-language A2A CLI.

The hosted A2A route currently turns "swap" / "quote" language into quotes.
There is no A2A execution method today, so this client never signs, broadcasts,
or submits managed swap execution.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import time
from typing import Any

import requests

A2A_PROTOCOL_VERSION = "0.3"
DEFAULT_A2A_URL = "https://api.suwappu.bot/a2a"
DEFAULT_AGENT_CARD_URL = "https://api.suwappu.bot/.well-known/agent.json"
REQUEST_TIMEOUT_SECONDS = 30
DEFAULT_POLL_TIMEOUT_SECONDS = 120
SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

task_history: list[dict[str, str]] = []
current_task_id: str | None = None


def build_message_params(text: str) -> dict[str, Any]:
    """Build the A2A 0.3 message shape while retaining server compatibility."""
    return {
        "message": {
            "kind": "message",
            "role": "user",
            "parts": [
                {
                    "type": "text",
                    "kind": "text",
                    "text": text,
                }
            ],
        }
    }


def task_id_params(task_id: str) -> dict[str, str]:
    """A2A 0.3 uses params.id; the server also accepts legacy taskId."""
    return {"id": task_id}


def is_terminal_state(state: str) -> bool:
    return state in {"completed", "failed", "canceled"}


def format_artifacts(artifacts: list[dict[str, Any]] | None) -> str:
    output: list[str] = []
    for artifact in artifacts or []:
        for part in artifact.get("parts", []):
            if not isinstance(part, dict):
                continue
            kind = part.get("kind", part.get("type"))
            if kind == "text" and isinstance(part.get("text"), str):
                output.append(part["text"])
            elif kind == "data" and "data" in part:
                output.append(json.dumps(part["data"], indent=2))
    return "\n".join(output)


class A2aClient:
    """Minimal authenticated JSON-RPC client plus public Agent Card discovery."""

    def __init__(
        self,
        api_key: str = "",
        url: str | None = None,
        agent_card_url: str | None = None,
    ):
        self.api_key = api_key
        self.url = url or os.environ.get("SUWAPPU_A2A_URL", DEFAULT_A2A_URL)
        self.agent_card_url = agent_card_url or os.environ.get(
            "SUWAPPU_AGENT_CARD_URL", DEFAULT_AGENT_CARD_URL
        )
        self.request_id = 0

    def _next_id(self) -> int:
        self.request_id += 1
        return self.request_id

    def _rpc(
        self,
        method: str,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        response = requests.post(
            self.url,
            headers=headers,
            json={
                "jsonrpc": "2.0",
                "id": self._next_id(),
                "method": method,
                "params": params,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        try:
            envelope = response.json()
        except requests.exceptions.JSONDecodeError as exc:
            response.raise_for_status()
            raise RuntimeError("Suwappu A2A returned invalid JSON") from exc

        if not isinstance(envelope, dict):
            raise RuntimeError("Suwappu A2A returned a non-object JSON-RPC response")

        if "error" in envelope:
            error = envelope["error"]
            raise RuntimeError(
                f"A2A error {error.get('code', 'unknown')}: "
                f"{error.get('message', 'unknown error')} "
                f"(HTTP {response.status_code})"
            )

        response.raise_for_status()
        result = envelope.get("result")
        if not isinstance(result, dict):
            raise RuntimeError(f"A2A method {method} returned no object result")
        return result

    def get_agent_card(self) -> dict[str, Any]:
        response = requests.get(
            self.agent_card_url,
            headers={"Accept": "application/json"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        card = response.json()
        if not isinstance(card, dict):
            raise RuntimeError("Suwappu Agent Card returned a non-object document")
        return card

    def send_message(self, text: str) -> dict[str, Any]:
        return self._rpc("message/send", build_message_params(text))

    def get_task(self, task_id: str) -> dict[str, Any]:
        return self._rpc("tasks/get", task_id_params(task_id))

    def cancel_task(self, task_id: str) -> dict[str, Any]:
        return self._rpc("tasks/cancel", task_id_params(task_id))


def extract_task(result: dict[str, Any]) -> dict[str, Any]:
    task = result.get("task")
    if (
        not isinstance(task, dict)
        or not isinstance(task.get("id"), str)
        or not isinstance(task.get("status"), dict)
    ):
        raise RuntimeError("Malformed A2A task result")
    return task


def update_history(task: dict[str, Any]) -> None:
    status = task["status"]
    task_id = task["id"]
    existing = next(
        (entry for entry in task_history if entry["id"] == task_id),
        None,
    )
    if existing:
        existing["state"] = str(status.get("state", "unknown"))
        existing["timestamp"] = str(
            status.get("timestamp", existing["timestamp"])
        )
        return

    task_history.append(
        {
            "id": task_id,
            "state": str(status.get("state", "unknown")),
            "timestamp": str(status.get("timestamp", "")),
        }
    )


def render_task(task: dict[str, Any]) -> None:
    status = task["status"]
    state = str(status.get("state", "unknown"))
    if state == "completed":
        output = format_artifacts(task.get("artifacts"))
        print(output or status.get("message", "Done."))
    elif state in {"failed", "canceled"}:
        print(f"Task {state}: {status.get('message', state)}")


def poll_timeout_seconds() -> float:
    raw = os.environ.get(
        "SUWAPPU_A2A_POLL_TIMEOUT_MS",
        str(DEFAULT_POLL_TIMEOUT_SECONDS * 1000),
    )
    try:
        value_ms = float(raw)
    except ValueError:
        return DEFAULT_POLL_TIMEOUT_SECONDS
    return value_ms / 1000 if value_ms > 0 else DEFAULT_POLL_TIMEOUT_SECONDS


def poll_task(client: A2aClient, task_id: str) -> dict[str, Any]:
    global current_task_id
    current_task_id = task_id
    deadline = time.monotonic() + poll_timeout_seconds()
    frame = 0

    try:
        while time.monotonic() < deadline:
            task = extract_task(client.get_task(task_id))
            update_history(task)
            state = str(task["status"].get("state", "unknown"))
            if is_terminal_state(state):
                sys.stdout.write("\r" + " " * 48 + "\r")
                render_task(task)
                return task

            sys.stdout.write(
                f"\r  {SPINNER[frame % len(SPINNER)]} A2A task {state}..."
            )
            sys.stdout.flush()
            frame += 1
            time.sleep(1)
    finally:
        current_task_id = None

    raise RuntimeError(
        f"A2A task {task_id} did not finish within "
        f"{poll_timeout_seconds():g}s; use the task id to inspect it later"
    )


def handle_response(client: A2aClient, result: dict[str, Any]) -> dict[str, Any]:
    task = extract_task(result)
    update_history(task)
    state = str(task["status"].get("state", "unknown"))

    if is_terminal_state(state):
        render_task(task)
    elif state in {"submitted", "working"}:
        task = poll_task(client, task["id"])
    else:
        print(f"Unexpected task state: {state}")
    return task


def print_history() -> None:
    if not task_history:
        print("No local A2A task history yet.")
        return

    print(f"\n  {'#':<4} {'Task ID':<40} {'State':<12} Time")
    print("  " + "-" * 74)
    for index, entry in enumerate(task_history, 1):
        print(
            f"  {index:<4} {entry['id']:<40} "
            f"{entry['state']:<12} {entry['timestamp']}"
        )
    print()


def print_help() -> None:
    print(
        """
  Suwappu Natural-Language A2A CLI
  ───────────────────────────────
  A2A 0.3 natural-language examples:

    swap 0.5 ETH to USDC on base    # quote only; no execution
    quote 100 USDC to WBTC on base  # quote only
    price ETH SOL BTC
    chains
    tokens on solana
    balance 0x...                    # returns a portfolio integration hint

  Local commands:
    card      Inspect Suwappu's public Agent Card
    history   Show local A2A task history (not swap history)
    help      Show this help
    quit      Exit

  Actual portfolio reads are available via MCP get_portfolio or the agent REST API.
  This CLI never signs, broadcasts, or submits managed swap execution.
"""
    )


def render_card_summary(card: dict[str, Any]) -> None:
    protocols = card.get("protocolVersions", [])
    skills = card.get("skills", [])
    interfaces = card.get("interfaces", [])
    if not isinstance(protocols, list):
        protocols = []
    if not isinstance(skills, list):
        skills = []
    if not isinstance(interfaces, list):
        interfaces = []

    print(f"{card.get('name', 'Suwappu')} Agent Card v{card.get('version', 'unknown')}")
    print(f"  A2A protocol: {', '.join(map(str, protocols)) or 'unknown'}")
    print(f"  Interfaces: {len(interfaces)}")
    print(f"  Skills: {len(skills)}")
    for skill in skills:
        if isinstance(skill, dict):
            print(
                f"    - {skill.get('id', skill.get('name', 'unknown'))}: "
                f"{skill.get('description', '')}"
            )


def setup_signal_handler(client: A2aClient) -> None:
    def handler(_signum: int, _frame: Any) -> None:
        global current_task_id
        if current_task_id:
            task_id = current_task_id
            sys.stdout.write("\r" + " " * 48 + "\r")
            print(f"Canceling A2A task {task_id}...")
            try:
                task = extract_task(client.cancel_task(task_id))
                update_history(task)
                print(f"Task is now {task['status'].get('state', 'unknown')}.")
            except (RuntimeError, requests.RequestException) as exc:
                print(f"Cancel failed: {exc}")
            current_task_id = None
        else:
            print("\nGoodbye!")
            raise SystemExit(0)

    signal.signal(signal.SIGINT, handler)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Natural-language A2A 0.3 quote/discovery CLI for Suwappu"
    )
    parser.add_argument(
        "--card",
        action="store_true",
        help="inspect the public Suwappu Agent Card; no API key required",
    )
    parser.add_argument(
        "--once",
        nargs="+",
        metavar="TEXT",
        help="send one natural-language message and exit",
    )
    args = parser.parse_args()

    api_key = os.environ.get("SUWAPPU_API_KEY", "")
    client = A2aClient(api_key)

    if args.card:
        render_card_summary(client.get_agent_card())
        return

    if not api_key:
        raise RuntimeError(
            "SUWAPPU_API_KEY is required for A2A messages; --card works anonymously"
        )

    if args.once:
        text = " ".join(args.once).strip()
        task = handle_response(client, client.send_message(text))
        print(f"A2A task: {task['id']}", file=sys.stderr)
        return

    setup_signal_handler(client)
    print_help()

    while True:
        try:
            user_input = input("suwappu> ").strip()
        except EOFError:
            print("\nGoodbye!")
            break

        if not user_input:
            continue

        lower = user_input.lower()
        if lower in {"quit", "exit"}:
            print("Goodbye!")
            break
        if lower == "help":
            print_help()
            continue
        if lower == "history":
            print_history()
            continue
        if lower == "card":
            try:
                render_card_summary(client.get_agent_card())
            except requests.RequestException as exc:
                print(f"Agent Card error: {exc}")
            continue

        try:
            handle_response(client, client.send_message(user_input))
        except (RuntimeError, requests.RequestException) as exc:
            message = str(exc)
            if "429" in message:
                print("Rate limited. Wait a moment and try again.")
            else:
                print(f"Error: {message}")

        print()


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, requests.RequestException) as exc:
        raise SystemExit(f"Error: {exc}") from exc
