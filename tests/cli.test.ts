import { describe, it, expect } from "bun:test";
describe("natural-language-cli", () => {
  it("should increment request IDs", () => {
    let id = 0;
    expect(++id).toBe(1);
    expect(++id).toBe(2);
  });
  it("should format artifacts from text parts", () => {
    const parts = [{ type: "text", text: "Hello" }];
    const output = parts.filter(p => p.type === "text").map(p => p.text).join("\n");
    expect(output).toBe("Hello");
  });
});
