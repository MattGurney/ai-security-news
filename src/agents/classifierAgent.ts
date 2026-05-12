import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import type { ClassifiedCandidate, SecurityCandidate, TriageDecision } from "../types.js";

const DEFAULT_OPENAI_MODEL = "gpt-5.5";

const ClassificationBatchSchema = z
  .object({
    decisions: z
      .array(
        z.object({
          candidateId: z.number().int(),
          decision: z.enum(["ignore", "monitor", "analyze"]),
          rationale: z.string(),
          confidence: z.number().min(0).max(1)
        })
      )
      .describe("One triage decision for each candidate id.")
  })
  .describe("Batch triage decisions for security news candidates.");

interface ClassificationBatch {
  decisions: Array<{
    candidateId: number;
    decision: TriageDecision;
    rationale: string;
    confidence: number;
  }>;
}

export interface ClassifierModel {
  invoke(input: string): Promise<ClassificationBatch>;
}

export interface ClassifierAgentOptions {
  model?: ClassifierModel | null;
}

/** Performs cheap semantic triage before the stronger analyst agent runs. */
export class ClassifierAgent {
  private readonly model: ClassifierModel | undefined;

  constructor(options: ClassifierAgentOptions = {}) {
    this.model = options.model === null ? undefined : options.model ?? createDefaultClassifierModel();
  }

  /** Classifies candidates into ignore, monitor, or analyze decisions. */
  async classifyCandidates(candidates: SecurityCandidate[]): Promise<ClassifiedCandidate[]> {
    if (candidates.length === 0) {
      return [];
    }

    if (this.model === undefined) {
      return candidates.map((candidate) => createFallbackClassification(candidate));
    }

    const batch = await this.model.invoke(createClassificationPrompt(candidates));
    const decisionsById = new Map(batch.decisions.map((decision) => [decision.candidateId, decision]));

    return candidates.map((candidate) => {
      const decision = decisionsById.get(candidate.item.id);

      if (decision === undefined) {
        return createFallbackClassification(candidate);
      }

      return {
        candidate,
        decision: decision.decision,
        rationale: decision.rationale,
        confidence: decision.confidence
      };
    });
  }
}

/** Builds the default OpenAI-backed structured-output classifier model when credentials exist. */
export function createDefaultClassifierModel(): ClassifierModel | undefined {
  if (process.env.OPENAI_API_KEY === undefined || process.env.OPENAI_API_KEY.trim() === "") {
    return undefined;
  }

  const model = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_CLASSIFIER_MODEL ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
    useResponsesApi: true
  });

  return model.withStructuredOutput(ClassificationBatchSchema, {
    name: "ClassificationBatch",
    strict: true
  });
}

function createClassificationPrompt(candidates: SecurityCandidate[]): string {
  return [
    "You are a fast security news triage classifier.",
    "Classify each candidate as:",
    "- ignore: not useful for security intelligence",
    "- monitor: relevant or adjacent, but not worth deep analysis yet",
    "- analyze: likely security intelligence that deserves a stronger analyst pass",
    "",
    "Prefer analyze for active incidents, vulnerabilities, exploitation, breaches, supply-chain compromise, malware, prompt injection, or AI used offensively.",
    "Prefer monitor for AI/security-adjacent items, privacy concerns, or agent/tooling stories with plausible security implications.",
    "Prefer ignore for generic AI, generic software, or non-technical stories with weak security connection.",
    "",
    "Candidates:",
    ...candidates.map((candidate) =>
      [
        `ID: ${candidate.item.id}`,
        `Title: ${candidate.item.title}`,
        `URL: ${candidate.item.url}`,
        `HN score: ${candidate.item.score}`,
        `Signals: ${candidate.matchedSignals.join(", ")}`,
        `Deterministic score: ${candidate.relevanceScore}`
      ].join("\n")
    )
  ].join("\n\n");
}

function createFallbackClassification(candidate: SecurityCandidate): ClassifiedCandidate {
  const decision = chooseFallbackDecision(candidate);

  return {
    candidate,
    decision,
    rationale: `Fallback triage based on deterministic score ${candidate.relevanceScore} and signals: ${candidate.matchedSignals.join(", ")}.`,
    confidence: Math.min(Math.max(candidate.relevanceScore / 12, 0.35), 1)
  };
}

function chooseFallbackDecision(candidate: SecurityCandidate): TriageDecision {
  if (candidate.relevanceScore >= 8) {
    return "analyze";
  }

  if (candidate.relevanceScore >= 5) {
    return "monitor";
  }

  return "ignore";
}
