export const A2A_PROTOCOL_VERSION = "0.3";
export const DEFAULT_A2A_URL = "https://api.suwappu.bot/a2a";
export const DEFAULT_AGENT_CARD_URL =
  "https://api.suwappu.bot/.well-known/agent.json";
export const REQUEST_TIMEOUT_MS = 30_000;

export type A2aTaskState =
  | "submitted"
  | "working"
  | "completed"
  | "failed"
  | "canceled";

export type A2aPart =
  | { type?: "text"; kind?: "text"; text: string }
  | { type?: "data"; kind?: "data"; data: unknown };

export interface A2aArtifact {
  parts?: A2aPart[];
}

export interface A2aTask {
  id: string;
  status: {
    state: A2aTaskState;
    message?: string;
    timestamp?: string;
  };
  artifacts?: A2aArtifact[];
}

export interface A2aTaskResult {
  task: A2aTask;
}

interface JsonRpcEnvelope<T> {
  jsonrpc?: string;
  id?: string | number | null;
  result?: T;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
}

export function buildMessageParams(text: string) {
  return {
    message: {
      kind: "message",
      role: "user",
      parts: [
        {
          type: "text",
          kind: "text",
          text,
        },
      ],
    },
  };
}

export function taskIdParams(id: string): { id: string } {
  return { id };
}

export function isTerminalState(state: string): boolean {
  return state === "completed" || state === "failed" || state === "canceled";
}

export function isSpecialCommand(input: string): boolean {
  return ["quit", "exit", "help", "history", "card"].includes(
    input.trim().toLowerCase(),
  );
}

export function formatArtifacts(artifacts: A2aArtifact[] = []): string {
  const output: string[] = [];

  for (const artifact of artifacts) {
    for (const part of artifact.parts ?? []) {
      const kind = part.kind ?? part.type;
      if (kind === "text" && "text" in part && part.text) {
        output.push(part.text);
      } else if (kind === "data" && "data" in part) {
        output.push(JSON.stringify(part.data, null, 2));
      }
    }
  }

  return output.join("\n");
}

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

export class A2aClient {
  private requestId = 0;
  readonly url: string;
  readonly agentCardUrl: string;

  constructor(
    private readonly apiKey = "",
    url = process.env.SUWAPPU_A2A_URL ?? DEFAULT_A2A_URL,
    agentCardUrl = process.env.SUWAPPU_AGENT_CARD_URL ?? DEFAULT_AGENT_CARD_URL,
  ) {
    this.url = url;
    this.agentCardUrl = agentCardUrl;
  }

  private async rpc<T>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++this.requestId,
        method,
        params,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const raw = await response.text();
    const envelope = parseJson<JsonRpcEnvelope<T>>(raw, "Suwappu A2A");

    if (envelope.error) {
      throw new Error(
        `A2A error ${envelope.error.code ?? "unknown"}: ${
          envelope.error.message ?? "unknown error"
        } (HTTP ${response.status})`,
      );
    }
    if (!response.ok) {
      throw new Error(`Suwappu A2A HTTP ${response.status}: ${raw}`);
    }
    if (envelope.result === undefined) {
      throw new Error(`A2A method ${method} returned no result`);
    }

    return envelope.result;
  }

  async getAgentCard(): Promise<Record<string, unknown>> {
    const response = await fetch(this.agentCardUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(
        `Agent Card HTTP ${response.status}: ${raw || response.statusText}`,
      );
    }

    const card = parseJson<unknown>(raw, "Suwappu Agent Card");
    if (!card || typeof card !== "object" || Array.isArray(card)) {
      throw new Error("Suwappu Agent Card returned a non-object document");
    }
    return card as Record<string, unknown>;
  }

  sendMessage(text: string): Promise<A2aTaskResult> {
    return this.rpc<A2aTaskResult>("message/send", buildMessageParams(text));
  }

  getTask(id: string): Promise<A2aTaskResult> {
    return this.rpc<A2aTaskResult>("tasks/get", taskIdParams(id));
  }

  cancelTask(id: string): Promise<A2aTaskResult> {
    return this.rpc<A2aTaskResult>("tasks/cancel", taskIdParams(id));
  }
}
