#!/usr/bin/env bun
/**
 * Suwappu natural-language A2A CLI.
 *
 * Current A2A "swap" / "quote" language returns a quote. The hosted A2A route
 * has no execution method today; this client never signs or broadcasts trades.
 */

import * as readline from "node:readline";
import {
  A2aClient,
  formatArtifacts,
  isTerminalState,
  type A2aTask,
} from "./a2a.js";

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const DEFAULT_POLL_TIMEOUT_MS = 120_000;

interface HistoryEntry {
  id: string;
  state: string;
  timestamp: string;
}

const taskHistory: HistoryEntry[] = [];
let currentTaskId: string | null = null;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function pollTimeoutMs(): number {
  const parsed = Number(
    process.env.SUWAPPU_A2A_POLL_TIMEOUT_MS ?? DEFAULT_POLL_TIMEOUT_MS,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POLL_TIMEOUT_MS;
}

function renderTask(task: A2aTask): void {
  const state = task.status.state;
  if (state === "completed") {
    const output = formatArtifacts(task.artifacts);
    console.log(output || task.status.message || "Done.");
    return;
  }

  if (state === "failed" || state === "canceled") {
    console.log(`Task ${state}: ${task.status.message ?? state}`);
  }
}

function updateHistory(task: A2aTask): void {
  const existing = taskHistory.find((entry) => entry.id === task.id);
  if (existing) {
    existing.state = task.status.state;
    existing.timestamp = task.status.timestamp ?? existing.timestamp;
    return;
  }

  taskHistory.push({
    id: task.id,
    state: task.status.state,
    timestamp: task.status.timestamp ?? "",
  });
}

async function pollTask(client: A2aClient, taskId: string): Promise<A2aTask> {
  currentTaskId = taskId;
  const deadline = Date.now() + pollTimeoutMs();
  let frame = 0;

  try {
    while (Date.now() < deadline) {
      const { task } = await client.getTask(taskId);
      updateHistory(task);

      if (isTerminalState(task.status.state)) {
        process.stdout.write("\r" + " ".repeat(48) + "\r");
        renderTask(task);
        return task;
      }

      process.stdout.write(
        `\r  ${SPINNER[frame % SPINNER.length]} A2A task ${task.status.state}...`,
      );
      frame++;
      await sleep(1000);
    }
  } finally {
    currentTaskId = null;
  }

  throw new Error(
    `A2A task ${taskId} did not finish within ${pollTimeoutMs()}ms; use the task id to inspect it later`,
  );
}

async function handleResponse(
  client: A2aClient,
  task: A2aTask,
): Promise<void> {
  updateHistory(task);

  if (isTerminalState(task.status.state)) {
    renderTask(task);
    return;
  }

  if (task.status.state === "submitted" || task.status.state === "working") {
    await pollTask(client, task.id);
    return;
  }

  console.log(`Unexpected task state: ${task.status.state}`);
}

function printHistory(): void {
  if (!taskHistory.length) {
    console.log("No local A2A task history yet.");
    return;
  }

  console.log(
    `\n  ${"#".padEnd(4)} ${"Task ID".padEnd(40)} ${"State".padEnd(12)} Time`,
  );
  console.log(`  ${"-".repeat(74)}`);
  taskHistory.forEach((entry, index) => {
    console.log(
      `  ${String(index + 1).padEnd(4)} ${entry.id.padEnd(40)} ${entry.state.padEnd(12)} ${entry.timestamp}`,
    );
  });
  console.log();
}

function printHelp(): void {
  console.log(`
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
`);
}

function printUsage(): void {
  console.log(`Usage:
  bun run src/cli.ts
  bun run src/cli.ts --once "price ETH"
  bun run src/cli.ts --card

Environment:
  SUWAPPU_API_KEY              Required for A2A message/task methods
  SUWAPPU_A2A_URL              Optional A2A endpoint override
  SUWAPPU_AGENT_CARD_URL       Optional Agent Card override
  SUWAPPU_A2A_POLL_TIMEOUT_MS  Optional task polling timeout
`);
}

function renderCardSummary(card: Record<string, unknown>): void {
  const protocols = Array.isArray(card.protocolVersions)
    ? card.protocolVersions.join(", ")
    : "unknown";
  const skills = Array.isArray(card.skills) ? card.skills : [];
  const interfaces = Array.isArray(card.interfaces) ? card.interfaces : [];

  console.log(
    `${String(card.name ?? "Suwappu")} Agent Card v${String(
      card.version ?? "unknown",
    )}`,
  );
  console.log(`  A2A protocol: ${protocols}`);
  console.log(`  Interfaces: ${interfaces.length}`);
  console.log(`  Skills: ${skills.length}`);
  for (const skill of skills) {
    if (!skill || typeof skill !== "object" || Array.isArray(skill)) continue;
    const entry = skill as Record<string, unknown>;
    console.log(
      `    - ${String(entry.id ?? entry.name ?? "unknown")}: ${String(
        entry.description ?? "",
      )}`,
    );
  }
}

async function runOnce(client: A2aClient, text: string): Promise<void> {
  if (!text.trim()) throw new Error("--once requires a natural-language message");
  const { task } = await client.sendMessage(text.trim());
  await handleResponse(client, task);
  console.error(`A2A task: ${task.id}`);
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    printUsage();
    return;
  }

  const apiKey = process.env.SUWAPPU_API_KEY ?? "";
  const client = new A2aClient(apiKey);

  if (rawArgs.includes("--card")) {
    renderCardSummary(await client.getAgentCard());
    return;
  }

  if (!apiKey) {
    throw new Error(
      "SUWAPPU_API_KEY is required for A2A messages; --card works anonymously",
    );
  }

  const onceIndex = rawArgs.indexOf("--once");
  if (onceIndex >= 0) {
    await runOnce(client, rawArgs.slice(onceIndex + 1).join(" "));
    return;
  }

  let busy = false;
  process.on("SIGINT", async () => {
    if (currentTaskId) {
      const taskId = currentTaskId;
      process.stdout.write("\r" + " ".repeat(48) + "\r");
      console.log(`Canceling A2A task ${taskId}...`);
      try {
        const { task } = await client.cancelTask(taskId);
        updateHistory(task);
        console.log(`Task is now ${task.status.state}.`);
      } catch (error) {
        console.error(
          `Cancel failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      currentTaskId = null;
      return;
    }

    console.log("\nGoodbye!");
    process.exit(0);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "suwappu> ",
  });

  printHelp();
  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (busy) {
      console.log("A task is already being handled; wait for it or press Ctrl+C.");
      rl.prompt();
      return;
    }

    const lower = input.toLowerCase();
    if (lower === "quit" || lower === "exit") {
      rl.close();
      return;
    }
    if (lower === "help") {
      printHelp();
      rl.prompt();
      return;
    }
    if (lower === "history") {
      printHistory();
      rl.prompt();
      return;
    }
    if (lower === "card") {
      try {
        renderCardSummary(await client.getAgentCard());
      } catch (error) {
        console.error(
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      rl.prompt();
      return;
    }

    busy = true;
    rl.pause();
    try {
      const { task } = await client.sendMessage(input);
      await handleResponse(client, task);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("429")) {
        console.log("Rate limited. Wait a moment and try again.");
      } else {
        console.error(`Error: ${message}`);
      }
    } finally {
      busy = false;
      console.log();
      rl.resume();
      rl.prompt();
    }
  });

  rl.on("close", () => {
    console.log("\nGoodbye!");
  });
}

main().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
