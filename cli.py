#!/usr/bin/env python3
"""
Suwappu Natural Language Trade CLI — Python
Interactive REPL for communicating with Suwappu via the A2A protocol.
"""

import os
import sys
import json
import time
import signal
import requests

A2A_URL = "https://api.suwappu.bot/a2a"

# Spinner frames for polling animation
SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

# Track state
request_id = 0
task_history = []
current_task_id = None


def next_id():
    """Generate incrementing JSON-RPC request IDs."""
    global request_id
    request_id += 1
    return request_id


def a2a_request(headers, method, params):
    """Send a JSON-RPC 2.0 request to the A2A endpoint."""
    payload = {
        "jsonrpc": "2.0",
        "id": next_id(),
        "method": method,
        "params": params,
    }
    response = requests.post(A2A_URL, headers=headers, json=payload)
    response.raise_for_status()
    data = response.json()

    if "error" in data:
        raise Exception(f"A2A error {data['error']['code']}: {data['error']['message']}")

    return data["result"]


def send_message(headers, text):
    """Send a natural language message via message/send."""
    return a2a_request(headers, "message/send", {
        "message": {
            "role": "user",
            "parts": [{"type": "text", "text": text}],
        }
    })


def get_task(headers, task_id):
    """Poll a task by ID via tasks/get."""
    return a2a_request(headers, "tasks/get", {"taskId": task_id})


def cancel_task(headers, task_id):
    """Cancel a running task via tasks/cancel."""
    return a2a_request(headers, "tasks/cancel", {"taskId": task_id})


def format_artifacts(artifacts):
    """Pretty-print task artifacts."""
    output = []
    for artifact in artifacts:
        for part in artifact.get("parts", []):
            if part["type"] == "text":
                output.append(part["text"])
            elif part["type"] == "data":
                output.append(json.dumps(part["data"], indent=2))
    return "\n".join(output)


def poll_task(headers, task_id):
    """Poll a task until it reaches a terminal state, showing a spinner."""
    global current_task_id
    current_task_id = task_id
    frame = 0

    try:
        while True:
            result = get_task(headers, task_id)
            task = result["task"]
            state = task["status"]["state"]

            if state == "completed":
                # Clear spinner line
                sys.stdout.write("\r" + " " * 40 + "\r")
                if task.get("artifacts"):
                    print(format_artifacts(task["artifacts"]))
                else:
                    print(task["status"].get("message", "Done."))
                return task

            elif state in ("failed", "canceled"):
                sys.stdout.write("\r" + " " * 40 + "\r")
                message = task["status"].get("message", state.capitalize())
                print(f"Task {state}: {message}")
                return task

            # Show spinner
            sys.stdout.write(f"\r  {SPINNER[frame % len(SPINNER)]} Processing...")
            sys.stdout.flush()
            frame += 1
            time.sleep(1)

    finally:
        current_task_id = None


def handle_response(headers, result):
    """Handle a message/send response — print immediately or poll."""
    task = result["task"]
    state = task["status"]["state"]
    task_id = task["id"]

    # Save to history
    task_history.append({
        "id": task_id,
        "state": state,
        "timestamp": task["status"].get("timestamp", ""),
    })

    if state == "completed":
        if task.get("artifacts"):
            print(format_artifacts(task["artifacts"]))
        else:
            print(task["status"].get("message", "Done."))
    elif state in ("submitted", "working"):
        poll_task(headers, task_id)
    elif state == "failed":
        message = task["status"].get("message", "Unknown error")
        print(f"Failed: {message}")
    else:
        print(f"Unexpected state: {state}")


def print_history():
    """Print local task history."""
    if not task_history:
        print("No task history yet.")
        return

    print(f"\n  {'#':<4} {'Task ID':<40} {'State':<12} {'Time'}")
    print(f"  {'-' * 70}")
    for i, entry in enumerate(task_history, 1):
        print(f"  {i:<4} {entry['id']:<40} {entry['state']:<12} {entry['timestamp']}")
    print()


def print_help():
    """Print help text."""
    print("""
  Suwappu Natural Language CLI
  ────────────────────────────
  Type any natural language command. Examples:

    swap 0.5 ETH to USDC on base
    price of ETH
    prices for ETH, BTC, SOL
    show my portfolio on ethereum
    list supported chains
    quote 100 USDC to WBTC

  Special commands:
    help      Show this help message
    history   Show task history
    quit      Exit the CLI

  Press Ctrl+C during a running task to cancel it.
""")


def setup_signal_handler(headers):
    """Set up Ctrl+C handler to cancel running tasks."""
    def handler(sig, frame):
        global current_task_id
        if current_task_id:
            sys.stdout.write("\r" + " " * 40 + "\r")
            print("Canceling task...")
            try:
                cancel_task(headers, current_task_id)
                print("Task canceled.")
            except Exception as e:
                print(f"Cancel failed: {e}")
            current_task_id = None
        else:
            print("\nGoodbye!")
            sys.exit(0)

    signal.signal(signal.SIGINT, handler)


def main():
    api_key = os.environ.get("SUWAPPU_API_KEY")
    if not api_key:
        print("Error: Set SUWAPPU_API_KEY environment variable.")
        print("  export SUWAPPU_API_KEY=suwappu_sk_your_api_key")
        sys.exit(1)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    setup_signal_handler(headers)
    print_help()

    while True:
        try:
            user_input = input("suwappu> ").strip()
        except EOFError:
            print("\nGoodbye!")
            break

        if not user_input:
            continue

        # Handle special commands
        lower = user_input.lower()
        if lower == "quit" or lower == "exit":
            print("Goodbye!")
            break
        elif lower == "help":
            print_help()
            continue
        elif lower == "history":
            print_history()
            continue

        # Send to A2A
        try:
            result = send_message(headers, user_input)
            handle_response(headers, result)
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                print("Rate limited. Wait a moment and try again.")
            else:
                print(f"HTTP error: {e}")
        except Exception as e:
            print(f"Error: {e}")

        print()  # Blank line between responses


if __name__ == "__main__":
    main()
