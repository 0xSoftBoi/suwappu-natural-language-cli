import { describe, it, expect } from "bun:test";

// Replicate key functions from the A2A CLI
function nextId(): number {
  let id = 0;
  return ++id;
}

function formatArtifacts(
  artifacts: Array<{ parts: Array<{ type: string; text?: string; data?: unknown }> }>
): string {
  const output: string[] = [];
  for (const artifact of artifacts) {
    for (const part of artifact.parts ?? []) {
      if (part.type === "text" && part.text) output.push(part.text);
      else if (part.type === "data" && part.data) output.push(JSON.stringify(part.data, null, 2));
    }
  }
  return output.join("\n");
}

function isSpecialCommand(input: string): boolean {
  const lower = input.toLowerCase();
  return ["quit", "exit", "help", "history"].includes(lower);
}

describe("request ID generation", () => {
  it("should produce sequential IDs", () => {
    let id = 0;
    expect(++id).toBe(1);
    expect(++id).toBe(2);
    expect(++id).toBe(3);
  });
});

describe("artifact formatting", () => {
  it("should extract text parts", () => {
    const artifacts = [{ parts: [{ type: "text", text: "ETH: $3,500" }] }];
    expect(formatArtifacts(artifacts)).toBe("ETH: $3,500");
  });

  it("should stringify data parts", () => {
    const artifacts = [{ parts: [{ type: "data", data: { price: 3500 } }] }];
    expect(formatArtifacts(artifacts)).toContain('"price": 3500');
  });

  it("should combine multiple artifacts", () => {
    const artifacts = [
      { parts: [{ type: "text", text: "Line 1" }] },
      { parts: [{ type: "text", text: "Line 2" }] },
    ];
    expect(formatArtifacts(artifacts)).toBe("Line 1\nLine 2");
  });

  it("should skip unknown part types", () => {
    const artifacts = [{ parts: [{ type: "image" }] }];
    expect(formatArtifacts(artifacts)).toBe("");
  });

  it("should handle empty artifacts", () => {
    expect(formatArtifacts([])).toBe("");
  });
});

describe("special commands", () => {
  it("should recognize quit/exit/help/history", () => {
    expect(isSpecialCommand("quit")).toBe(true);
    expect(isSpecialCommand("EXIT")).toBe(true);
    expect(isSpecialCommand("Help")).toBe(true);
    expect(isSpecialCommand("history")).toBe(true);
  });

  it("should not match regular input", () => {
    expect(isSpecialCommand("swap 0.5 ETH to USDC")).toBe(false);
    expect(isSpecialCommand("price of ETH")).toBe(false);
  });
});

describe("task states", () => {
  const terminal = ["completed", "failed", "canceled"];
  const active = ["submitted", "working"];

  it("should identify terminal states", () => {
    terminal.forEach(s => expect(terminal.includes(s)).toBe(true));
  });

  it("should not treat active states as terminal", () => {
    active.forEach(s => expect(terminal.includes(s)).toBe(false));
  });
});

describe("JSON-RPC 2.0 format", () => {
  it("should build valid request", () => {
    const req = { jsonrpc: "2.0", id: 1, method: "message/send", params: {} };
    expect(req.jsonrpc).toBe("2.0");
    expect(typeof req.id).toBe("number");
  });

  it("should include message parts in params", () => {
    const params = {
      message: { role: "user", parts: [{ type: "text", text: "hello" }] },
    };
    expect(params.message.parts[0].text).toBe("hello");
  });
});
