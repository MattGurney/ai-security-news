import { describe, expect, it } from "vitest";

import { createGreeting } from "./greeting.js";

describe("createGreeting", () => {
  it("greets the supplied name", () => {
    expect(createGreeting("AI security news")).toBe("Hello, AI security news!");
  });

  it("falls back to world for blank names", () => {
    expect(createGreeting("   ")).toBe("Hello, world!");
  });
});
