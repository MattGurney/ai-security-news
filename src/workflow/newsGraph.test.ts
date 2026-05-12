import { describe, expect, it, vi } from "vitest";

import { runNewsWorkflow, runNewsWorkflowForStories } from "./newsGraph.js";
import type { ClassifiedCandidate, IntelligenceItem, NewsItem, SecurityCandidate } from "../types.js";

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
    const intelligenceItem: IntelligenceItem = {
      candidate,
      analyzedBy: "llm",
      analysis: {
        summary: "A package ecosystem compromise may affect downstream consumers.",
        securityAngle: "Supply-chain compromise can propagate through trusted dependencies.",
        affectedAudience: "JavaScript maintainers and application security teams.",
        alertLevel: "high",
        confidence: 0.92
      }
    };
    const classifiedCandidate: ClassifiedCandidate = {
      candidate,
      decision: "analyze",
      rationale: "Supply-chain compromise deserves deep analysis.",
      confidence: 0.91
    };
    const fetchTopStories = vi.fn(async () => [story]);
    const findCandidates = vi.fn(() => [candidate]);
    const classifyCandidates = vi.fn(async () => [classifiedCandidate]);
    const analyzeCandidates = vi.fn(async () => [intelligenceItem]);
    const onProgress = vi.fn();
    const onPublish = vi.fn();

    const result = await runNewsWorkflow(5, {
      hackerNewsClient: { fetchTopStories },
      securityFilterAgent: { findCandidates },
      classifierAgent: { classifyCandidates },
      analystAgent: { analyzeCandidates },
      onProgress,
      onPublish
    });

    expect(fetchTopStories).toHaveBeenCalledWith(5);
    expect(findCandidates).toHaveBeenCalledWith([story]);
    expect(classifyCandidates).toHaveBeenCalledWith([candidate]);
    expect(analyzeCandidates).toHaveBeenCalledWith([candidate]);
    expect(onProgress).toHaveBeenCalledWith("Fetching 5 Hacker News stories...");
    expect(onProgress).toHaveBeenCalledWith("Filtering 1 stories for security signals...");
    expect(onProgress).toHaveBeenCalledWith("Classifying 1 candidates for routing...");
    expect(onProgress).toHaveBeenCalledWith("Analyzing 1 routed candidates...");
    expect(onProgress).toHaveBeenCalledWith("Publishing intelligence items...");
    expect(onPublish).toHaveBeenCalledWith({
      storyLimit: 5,
      inputStories: [],
      stories: [story],
      candidates: [candidate],
      classifiedCandidates: [classifiedCandidate],
      candidatesForAnalysis: [candidate],
      monitoredCandidates: [],
      ignoredCandidates: [],
      intelligenceItems: [intelligenceItem]
    });
    expect(result.intelligenceItems).toEqual([intelligenceItem]);
  });

  it("routes directly to publishing when classifier finds no analysis candidates", async () => {
    const story = createNewsItem({ id: 2, title: "AI agent tooling" });
    const candidate: SecurityCandidate = {
      item: story,
      relevanceScore: 5,
      matchedSignals: ["AI system", "agentic system"],
      reason: "Matched AI system, agentic system"
    };
    const classifiedCandidate: ClassifiedCandidate = {
      candidate,
      decision: "monitor",
      rationale: "Security-adjacent but not urgent.",
      confidence: 0.7
    };
    const analyzeCandidates = vi.fn(async () => []);

    const result = await runNewsWorkflow(5, {
      hackerNewsClient: { fetchTopStories: async () => [story] },
      securityFilterAgent: { findCandidates: () => [candidate] },
      classifierAgent: { classifyCandidates: async () => [classifiedCandidate] },
      analystAgent: { analyzeCandidates }
    });

    expect(analyzeCandidates).not.toHaveBeenCalled();
    expect(result.monitoredCandidates).toEqual([classifiedCandidate]);
    expect(result.intelligenceItems).toEqual([]);
  });

  it("can process pre-fetched stories without calling the Hacker News client", async () => {
    const story = createNewsItem({ id: 3, title: "Prefetched vulnerability" });
    const fetchTopStories = vi.fn(async () => []);

    const result = await runNewsWorkflowForStories([story], {
      hackerNewsClient: { fetchTopStories },
      securityFilterAgent: { findCandidates: (stories) => [createCandidate(stories[0] ?? story)] },
      classifierAgent: {
        classifyCandidates: async (candidates) =>
          candidates.map((candidate) => ({
            candidate,
            decision: "monitor",
            rationale: "Prefetched monitor test.",
            confidence: 0.8
          }))
      }
    });

    expect(fetchTopStories).not.toHaveBeenCalled();
    expect(result.stories).toEqual([story]);
    expect(result.monitoredCandidates).toHaveLength(1);
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

function createCandidate(story: NewsItem): SecurityCandidate {
  return {
    item: story,
    relevanceScore: 5,
    matchedSignals: ["vulnerability"],
    reason: "Matched vulnerability"
  };
}
