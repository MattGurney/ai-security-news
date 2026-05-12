/** A normalized news story from an external source. */
export interface NewsItem {
  id: number;
  title: string;
  url: string;
  source: "hacker-news";
  author: string;
  score: number;
  commentsUrl: string;
  publishedAt: Date;
}

/** A story selected by the deterministic first-pass security filter. */
export interface SecurityCandidate {
  item: NewsItem;
  relevanceScore: number;
  matchedSignals: string[];
  reason: string;
}

export type TriageDecision = "ignore" | "monitor" | "analyze";

/** A weak-classifier decision about whether a candidate deserves deeper analysis. */
export interface ClassifiedCandidate {
  candidate: SecurityCandidate;
  decision: TriageDecision;
  rationale: string;
  confidence: number;
}

export type AlertLevel = "low" | "medium" | "high" | "critical";

/** Model-generated or fallback assessment of a security candidate. */
export interface SecurityAnalysis {
  summary: string;
  securityAngle: string;
  affectedAudience: string;
  alertLevel: AlertLevel;
  confidence: number;
}

/** The final intelligence object emitted by the workflow. */
export interface IntelligenceItem {
  candidate: SecurityCandidate;
  analysis: SecurityAnalysis;
  analyzedBy: "llm" | "fallback";
}
