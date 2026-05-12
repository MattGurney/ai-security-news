import { describe, expect, it, vi } from "vitest";

import { runNewsWorkflow } from "./newsGraph.js";
import type { NewsItem, SecurityCandidate } from "../types.js";

describe("newsGraph", () => {
  it("fetches stories, filters candidates, and publishes the final state", async () => {
    const story = createNewsItem({
      id: 1,
      title: "Postmortem: NPM supply-chain compromise"
    });
    const candidate: SecurityCandidate = {
      item: story,
      relevanceScore: 10,
      matchedSignals: ["supply chain", "compromise"],
      reason: "Matched supply chain, compromise"
    };
    const fetchTopStories = vi.fn(async () => [story]);
    const findCandidates = vi.fn(() => [candidate]);
    const onPublish = vi.fn();

    const result = await runNewsWorkflow(5, {
      hackerNewsClient: { fetchTopStories },
      securityFilterAgent: { findCandidates },
      onPublish
    });

    expect(fetchTopStories).toHaveBeenCalledWith(5);
    expect(findCandidates).toHaveBeenCalledWith([story]);
    expect(onPublish).toHaveBeenCalledWith({
      storyLimit: 5,
      stories: [story],
      candidates: [candidate]
    });
    expect(result.candidates).toEqual([candidate]);
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
