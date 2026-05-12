import { describe, expect, it } from "vitest";

import { SecurityFilterAgent } from "./securityFilterAgent.js";
import type { NewsItem } from "../types.js";

describe("SecurityFilterAgent", () => {
  it("finds obvious security incidents", () => {
    const agent = new SecurityFilterAgent();

    const candidates = agent.findCandidates([
      createNewsItem({
        id: 1,
        title: "Postmortem: TanStack NPM supply-chain compromise"
      })
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.matchedSignals).toEqual([
      "supply chain",
      "compromise",
      "incident",
      "package ecosystem"
    ]);
    expect(candidates[0]?.relevanceScore).toBe(16);
  });

  it("finds AI security stories", () => {
    const agent = new SecurityFilterAgent();

    const candidates = agent.findCandidates([
      createNewsItem({
        id: 2,
        title: "Prompt injection attacks against LLM security tools"
      })
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.matchedSignals).toContain("prompt injection");
    expect(candidates[0]?.matchedSignals).toContain("AI security");
  });

  it("keeps AI platform stories as candidates for LLM review", () => {
    const agent = new SecurityFilterAgent();

    const candidates = agent.findCandidates([
      createNewsItem({
        id: 6,
        title: "OpenAI agents add browser sandbox support"
      })
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.matchedSignals).toContain("AI system");
    expect(candidates[0]?.matchedSignals).toContain("agentic system");
  });

  it("filters out unrelated stories", () => {
    const agent = new SecurityFilterAgent();

    const candidates = agent.findCandidates([
      createNewsItem({
        id: 3,
        title: "Learning Software Architecture"
      })
    ]);

    expect(candidates).toEqual([]);
  });

  it("sorts stronger matches first", () => {
    const agent = new SecurityFilterAgent();

    const candidates = agent.findCandidates([
      createNewsItem({
        id: 4,
        title: "A privacy and security preserving database"
      }),
      createNewsItem({
        id: 5,
        title: "Critical CVE vulnerability exploited in authentication service"
      })
    ]);

    expect(candidates.map((candidate) => candidate.item.id)).toEqual([5, 4]);
  });
});

function createNewsItem(overrides: Partial<NewsItem>): NewsItem {
  return {
    id: 1,
    title: "Example story",
    url: "https://example.com/story",
    source: "hacker-news",
    author: "example",
    score: 1,
    commentsUrl: "https://news.ycombinator.com/item?id=1",
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
  };
}
