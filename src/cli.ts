#!/usr/bin/env npx tsx
/**
 * Suwappu Natural Language Trade CLI — TypeScript
 * Interactive REPL for communicating with Suwappu via the A2A protocol.
 */

import * as readline from "readline";

const A2A_URL = "https://api.suwappu.bot/a2a";
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

let requestId = 0;
const taskHistory: Array<{ id: string; state: string; timestamp: string }> = [];
let currentTaskId: string | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nextId(): number {
  return ++requestId;
}

async function a2aRequest(apiKey: string, method: string, params: Record<string, unknown>) {
  const response = await fetch(A2A_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: nextId(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`A2A error ${data.error.code}: ${data.error.message}`);
  }
  return data.result;
}

async function sendMessage(apiKey: string, text: string) {
  return a2aRequest(apiKey, "message/send", {
    message: {
      role: "user",
      parts: [{ type: "text", text }],
    },
  });
}

async function getTask(apiKey: string, taskId: string) {
  return a2aRequest(apiKey, "tasks/get", { taskId });
}

async function cancelTask(apiKey: string, taskId: string) {
  return a2aRequest(apiKey, "tasks/cancel", { taskId });
}

function formatArtifacts(artifacts: Array<{ parts: Array<{ type: string; text?: string; data?: unknown }> }>): string {
  const output: string[] = [];
  for (const artifact of artifacts) {
    for (const part of artifact.parts ?? []) {
      if (part.type === "text" && part.text) {
        output.push(part.text);
      } else if (part.type === "data" && part.data) {
        output.push(JSON.stringify(part.data, null, 2));
      }
    }
  }
  return output.join("\n");
}

async function pollTask(apiKey: string, taskId: string) {
  currentTaskId = taskId;
  let frame = 0;

  try {
    while (true) {
      const result = await getTask(apiKey, taskId);
      const task = result.task;
      const state = task.status.state;

      if (state === "completed") {
        process.stdout.write("\r" + " ".repeat(40) + "\r");
        if (task.artifacts?.length) {
          console.log(formatArtifacts(task.artifacts));
        } else {
          console.log(task.status.message ?? "Done.");
        }
        return task;
      }

      if (state === "failed" || state === "canceled") {
        process.stdout.write("\r" + " ".repeat(40) + "\r");
        console.log(`Task ${state}: ${task.status.message ?? state}`);
        return task;
      }

      process.stdout.write(`\r  ${SPINNER[frame % SPINNER.length]} Processing...`);
      frame++;
      await sleep(1000);
    }
  } finally {
    currentTaskId = null;
  }
}

function handleResponse(apiKey: string, result: { task: any }) {
  const task = result.task;
  const state = task.status.state;

  taskHistory.push({
    id: task.id,
    state,
    timestamp: task.status.timestamp ?? "",
  });

  if (state === "completed") {
    if (task.artifacts?.length) {
      console.log(formatArtifacts(task.artifacts));
    } else {
      console.log(task.status.message ?? "Done.");
    }
    return Promise.resolve();
  }

  if (state === "submitted" || state === "working") {
    return pollTask(apiKey, task.id);
  }

  if (state === "failed") {
    console.log(`Failed: ${task.status.message ?? "Unknown error"}`);
  } else {
    console.log(`Unexpected state: ${state}`);
  }

  return Promise.resolve();
}

function printHistory() {
  if (taskHistory.length === 0) {
    console.log("No task history yet.");
    return;
  }

  console.log(`\n  ${"#".padEnd(4)} ${"Task ID".padEnd(40)} ${"State".padEnd(12)} Time`);
  console.log(`  ${"-".repeat(70)}`);
  taskHistory.forEach((entry, i) => {
    console.log(
      `  ${String(i + 1).padEnd(4)} ${entry.id.padEnd(40)} ${entry.state.padEnd(12)} ${entry.timestamp}`
    );
  });
  console.log();
}

function printHelp() {
  console.log(`
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
`);
}

async function main() {
  const apiKey = process.env.SUWAPPU_API_KEY;
  if (!apiKey) {
    console.error("Error: Set SUWAPPU_API_KEY environment variable.");
    process.exit(1);
  }

  // Handle Ctrl+C for task cancellation
  process.on("SIGINT", async () => {
    if (currentTaskId) {
      process.stdout.write("\r" + " ".repeat(40) + "\r");
      console.log("Canceling task...");
      try {
        await cancelTask(apiKey, currentTaskId);
        console.log("Task canceled.");
      } catch (e) {
        console.error(`Cancel failed: ${e}`);
      }
      currentTaskId = null;
    } else {
      console.log("\nGoodbye!");
      process.exit(0);
    }
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

    const lower = input.toLowerCase();
    if (lower === "quit" || lower === "exit") {
      console.log("Goodbye!");
      rl.close();
      process.exit(0);
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

    try {
      const result = await sendMessage(apiKey, input);
      await handleResponse(apiKey, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("429")) {
        console.log("Rate limited. Wait a moment and try again.");
      } else {
        console.error(`Error: ${message}`);
      }
    }

    console.log();
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nGoodbye!");
    process.exit(0);
  });
}

main().catch(console.error);
