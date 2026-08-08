import { describe, expect, it } from "bun:test";
import {
  A2A_PROTOCOL_VERSION,
  buildMessageParams,
  formatArtifacts,
  isSpecialCommand,
  isTerminalState,
  requestTimeoutMs,
  taskIdParams,
} from "../src/a2a.js";

describe("A2A 0.3 request shape", () => {
  it("builds a spec-aware message while retaining server compatibility", () => {
    expect(A2A_PROTOCOL_VERSION).toBe("0.3");
    expect(buildMessageParams("price ETH")).toEqual({
      message: {
        kind: "message",
        role: "user",
        parts: [
          {
            type: "text",
            kind: "text",
            text: "price ETH",
          },
        ],
      },
    });
  });

  it("uses the current task id parameter", () => {
    expect(taskIdParams("task-123")).toEqual({ id: "task-123" });
  });
});

describe("artifact formatting", () => {
  it("accepts current kind parts and compatibility type parts", () => {
    const output = formatArtifacts([
      {
        parts: [
          { kind: "text", text: "ETH: $3,500" },
          { type: "data", data: { price: 3500 } },
        ],
      },
    ]);

    expect(output).toContain("ETH: $3,500");
    expect(output).toContain('"price": 3500');
  });

  it("combines artifacts and handles empty input", () => {
    expect(
      formatArtifacts([
        { parts: [{ type: "text", text: "Line 1" }] },
        { parts: [{ kind: "text", text: "Line 2" }] },
      ]),
    ).toBe("Line 1\nLine 2");
    expect(formatArtifacts()).toBe("");
  });
});

describe("task state handling", () => {
  it("recognizes the hosted server terminal states", () => {
    expect(isTerminalState("completed")).toBe(true);
    expect(isTerminalState("failed")).toBe(true);
    expect(isTerminalState("canceled")).toBe(true);
    expect(isTerminalState("working")).toBe(false);
    expect(isTerminalState("submitted")).toBe(false);
  });
});

describe("local commands", () => {
  it("keeps protocol discovery local", () => {
    expect(isSpecialCommand("card")).toBe(true);
    expect(isSpecialCommand("Help")).toBe(true);
    expect(isSpecialCommand("history")).toBe(true);
    expect(isSpecialCommand("swap 0.5 ETH to USDC")).toBe(false);
  });
});

describe("operation deadline", () => {
  it("uses a bounded configurable request timeout", () => {
    expect(requestTimeoutMs(undefined)).toBe(25_000);
    expect(requestTimeoutMs("100")).toBe(100);
    expect(requestTimeoutMs("30000")).toBe(30_000);
    expect(() => requestTimeoutMs("99")).toThrow("100 to 30000");
    expect(() => requestTimeoutMs("30001")).toThrow("100 to 30000");
    expect(() => requestTimeoutMs("nope")).toThrow("100 to 30000");
  });
});
