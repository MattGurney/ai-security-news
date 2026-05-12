import { describe, expect, it } from "vitest";

import { ClassifierAgent } from "./classifierAgent.js";
import type { ClassifierModel } from "./classifierAgent.js";
import type { SecurityCandidate } from "../types.js";

describe("ClassifierAgent", () => {
  it("uses an injected model to classify candidates", async () => {
    const candidate = createSecurityCandidate({ id: 1, relevanceScore: 6 });
    const model: ClassifierModel = {
      async invoke(input) {
        expect(input).toContain("Classify each candidate");
        expect(input).toContain("ID: 1");

        return {
          decisions: [
            {
              candidateId: 1,
              decision: "monitor",
              rationale: "Security-adjacent AI tooling item.",
              confidence: 0.74
            }
          ]
        };
      }
    };
    const agent = new ClassifierAgent({ model });

    const classified = await agent.classifyCandidates([candidate]);

    expect(classified).toEqual([
      {
        candidate,
        decision: "monitor",
        rationale: "Security-adjacent AI tooling item.",
        confidence: 0.74
      }
    ]);
  });

  it("falls back to deterministic triage when no model is configured", async () => {
    const agent = new ClassifierAgent({ model: null });

    const classified = await agent.classifyCandidates([
      createSecurityCandidate({ id: 1, relevanceScore: 9 }),
      createSecurityCandidate({ id: 2, relevanceScore: 5 })
    ]);

    expect(classified.map((candidate) => candidate.decision)).toEqual(["analyze", "monitor"]);
  });
});

function createSecurityCandidate(overrides: { id: number; relevanceScore: number }): SecurityCandidate {
  return {
    item: {
      id: overrides.id,
      title: "Example security candidate",
      url: "https://example.com/security",
      source: "hacker-news",
      author: "example",
      score: 100,
      commentsUrl: `https://news.ycombinator.com/item?id=${overrides.id}`,
      publishedAt: new Date("2026-01-01T00:00:00.000Z")
    },
    relevanceScore: overrides.relevanceScore,
    matchedSignals: ["security"],
    reason: "Matched security"
  };
}
