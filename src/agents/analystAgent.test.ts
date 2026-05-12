import { describe, expect, it } from "vitest";

import { AnalystAgent } from "./analystAgent.js";
import type { AnalystModel } from "./analystAgent.js";
import type { SecurityCandidate } from "../types.js";

describe("AnalystAgent", () => {
  it("uses an injected model to produce LLM analysis", async () => {
    const candidate = createSecurityCandidate();
    const model: AnalystModel = {
      async invoke(input) {
        expect(input).toContain("Postmortem: NPM supply-chain compromise");

        return {
          summary: "A package ecosystem compromise may affect downstream consumers.",
          securityAngle: "Supply-chain compromise can propagate through trusted dependencies.",
          affectedAudience: "JavaScript maintainers and application security teams.",
          alertLevel: "high",
          confidence: 0.92
        };
      }
    };
    const agent = new AnalystAgent({ model });

    const items = await agent.analyzeCandidates([candidate]);

    expect(items).toEqual([
      {
        candidate,
        analyzedBy: "llm",
        analysis: {
          summary: "A package ecosystem compromise may affect downstream consumers.",
          securityAngle: "Supply-chain compromise can propagate through trusted dependencies.",
          affectedAudience: "JavaScript maintainers and application security teams.",
          alertLevel: "high",
          confidence: 0.92
        }
      }
    ]);
  });

  it("falls back when no model is configured", async () => {
    const agent = new AnalystAgent({ model: null });

    const items = await agent.analyzeCandidates([createSecurityCandidate()]);

    expect(items[0]?.analyzedBy).toBe("fallback");
    expect(items[0]?.analysis.securityAngle).toContain("supply chain");
  });
});

function createSecurityCandidate(): SecurityCandidate {
  return {
    item: {
      id: 1,
      title: "Postmortem: NPM supply-chain compromise",
      url: "https://example.com/postmortem",
      source: "hacker-news",
      author: "example",
      score: 100,
      commentsUrl: "https://news.ycombinator.com/item?id=1",
      publishedAt: new Date("2026-01-01T00:00:00.000Z")
    },
    relevanceScore: 10,
    matchedSignals: ["supply chain", "compromise"],
    reason: "Matched supply chain, compromise"
  };
}
