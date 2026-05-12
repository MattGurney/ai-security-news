import { describe, expect, it } from "vitest";

import { parseMonitorOptions, parseStoryLimit } from "./cli.js";

describe("parseStoryLimit", () => {
  it("caps story scans at 500", () => {
    expect(parseStoryLimit("999")).toBe(500);
  });
});

describe("parseMonitorOptions", () => {
  it("parses monitor flags", () => {
    expect(
      parseMonitorOptions([
        "--limit",
        "250",
        "--interval-seconds",
        "60",
        "--once",
        "--db",
        "data/test.sqlite",
        "--jsonl",
        "output/test.jsonl"
      ])
    ).toEqual({
      storyLimit: 250,
      intervalSeconds: 60,
      once: true,
      dbPath: "data/test.sqlite",
      jsonlPath: "output/test.jsonl"
    });
  });
});
