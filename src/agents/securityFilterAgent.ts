import type { NewsItem, SecurityCandidate } from "../types.js";

interface SecuritySignal {
  label: string;
  pattern: RegExp;
  weight: number;
}

const SECURITY_SIGNALS: SecuritySignal[] = [
  { label: "supply chain", pattern: /\bsupply[- ]chain\b/i, weight: 5 },
  { label: "compromise", pattern: /\bcompromised?\b|\bcompromise\b/i, weight: 5 },
  { label: "vulnerability", pattern: /\bvulnerabilit(?:y|ies)\b|\bcve-\d{4}-\d+\b/i, weight: 5 },
  { label: "exploit", pattern: /\bexploit(?:ed|s|ing)?\b/i, weight: 4 },
  { label: "breach", pattern: /\bbreach(?:ed|es)?\b|\bleak(?:ed|s)?\b/i, weight: 4 },
  { label: "malware", pattern: /\bmalware\b|\bransomware\b|\bspyware\b/i, weight: 4 },
  { label: "authentication", pattern: /\bauth(?:entication|orization)?\b|\boauth\b|\bsso\b/i, weight: 3 },
  { label: "cryptography", pattern: /\bcrypto(?:graphy|graphic)?\b|\bencryption\b|\btls\b|\bssl\b/i, weight: 3 },
  { label: "prompt injection", pattern: /\bprompt injection\b|\bjailbreak(?:ing)?\b/i, weight: 5 },
  { label: "AI security", pattern: /\bAI safety\b|\bLLM security\b|\bmodel security\b/i, weight: 4 },
  { label: "security", pattern: /\bsecurity\b|\binfosec\b|\bcyber(?:security)?\b/i, weight: 3 },
  { label: "privacy", pattern: /\bprivacy\b|\bsurveillance\b|\btracking\b/i, weight: 2 }
];

const MINIMUM_RELEVANCE_SCORE = 3;

/** Selects likely security stories using deterministic keyword signals. */
export class SecurityFilterAgent {
  /** Returns security candidates sorted by strongest relevance score first. */
  findCandidates(items: NewsItem[]): SecurityCandidate[] {
    return items
      .map((item) => this.scoreItem(item))
      .filter((candidate): candidate is SecurityCandidate => candidate !== null)
      .sort((left, right) => right.relevanceScore - left.relevanceScore);
  }

  private scoreItem(item: NewsItem): SecurityCandidate | null {
    const text = `${item.title} ${item.url}`;
    const matches = SECURITY_SIGNALS.filter((signal) => signal.pattern.test(text));
    const relevanceScore = matches.reduce((total, signal) => total + signal.weight, 0);

    if (relevanceScore < MINIMUM_RELEVANCE_SCORE) {
      return null;
    }

    const matchedSignals = matches.map((signal) => signal.label);

    return {
      item,
      relevanceScore,
      matchedSignals,
      reason: `Matched ${matchedSignals.join(", ")}`
    };
  }
}
