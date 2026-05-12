import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import type { IntelligenceItem, SecurityAnalysis, SecurityCandidate } from "../types.js";

const DEFAULT_OPENAI_MODEL = "gpt-5.5";

const SecurityAnalysisSchema = z
  .object({
    summary: z.string().describe("One sentence summary of the story."),
    securityAngle: z.string().describe("Why this item matters from a security perspective."),
    affectedAudience: z.string().describe("Who should pay attention to this item."),
    alertLevel: z.enum(["low", "medium", "high", "critical"]),
    confidence: z.number().min(0).max(1).describe("Confidence that this is security relevant.")
  })
  .describe("Security intelligence analysis for a news item.");

export interface AnalystModel {
  invoke(input: string): Promise<SecurityAnalysis>;
}

export interface AnalystAgentOptions {
  model?: AnalystModel | null;
}

/** Produces security intelligence analysis using an LLM when configured. */
export class AnalystAgent {
  private readonly model: AnalystModel | undefined;

  constructor(options: AnalystAgentOptions = {}) {
    this.model = options.model === null ? undefined : options.model ?? createDefaultAnalystModel();
  }

  /** Analyzes filtered candidates, falling back to deterministic summaries without an API key. */
  async analyzeCandidates(candidates: SecurityCandidate[]): Promise<IntelligenceItem[]> {
    return Promise.all(candidates.map((candidate) => this.analyzeCandidate(candidate)));
  }

  private async analyzeCandidate(candidate: SecurityCandidate): Promise<IntelligenceItem> {
    if (this.model === undefined) {
      return createFallbackIntelligenceItem(candidate);
    }

    const analysis = await this.model.invoke(createAnalysisPrompt(candidate));

    return {
      candidate,
      analysis,
      analyzedBy: "llm"
    };
  }
}

/** Builds the default OpenAI-backed structured-output analyst model when credentials exist. */
export function createDefaultAnalystModel(): AnalystModel | undefined {
  if (process.env.OPENAI_API_KEY === undefined || process.env.OPENAI_API_KEY.trim() === "") {
    return undefined;
  }

  const model = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
    useResponsesApi: true
  });

  return model.withStructuredOutput(SecurityAnalysisSchema, {
    name: "SecurityAnalysis",
    strict: true
  });
}

function createAnalysisPrompt(candidate: SecurityCandidate): string {
  const { item } = candidate;

  return [
    "You are a concise security news analyst.",
    "Analyze the Hacker News item and return practical security intelligence.",
    "Focus on the observable facts in the title, URL, HN score, and matched signals.",
    "",
    `Title: ${item.title}`,
    `URL: ${item.url}`,
    `HN score: ${item.score}`,
    `Author: ${item.author}`,
    `Matched signals: ${candidate.matchedSignals.join(", ")}`,
    `Deterministic relevance score: ${candidate.relevanceScore}`
  ].join("\n");
}

function createFallbackIntelligenceItem(candidate: SecurityCandidate): IntelligenceItem {
  const signals = candidate.matchedSignals.join(", ");

  return {
    candidate,
    analyzedBy: "fallback",
    analysis: {
      summary: candidate.item.title,
      securityAngle: `Matched deterministic security signals: ${signals}.`,
      affectedAudience: "Security teams and engineering teams monitoring relevant technology news.",
      alertLevel: candidate.relevanceScore >= 10 ? "high" : "medium",
      confidence: Math.min(candidate.relevanceScore / 10, 1)
    }
  };
}
