import type { ClassifiedCandidate, IntelligenceItem } from "./types.js";
import { runNewsWorkflow } from "./workflow/newsGraph.js";

const DEFAULT_STORY_LIMIT = 10;
const MAX_STORY_LIMIT = 500;

/** Runs the command-line workflow for a single Hacker News polling pass. */
export async function runCli(args: string[]): Promise<void> {
  const storyLimit = parseStoryLimit(args[2]);

  console.log(`Starting AI security news scan for ${storyLimit} Hacker News stories...`);

  const {
    stories,
    candidates,
    classifiedCandidates,
    candidatesForAnalysis,
    monitoredCandidates,
    ignoredCandidates,
    intelligenceItems
  } = await runNewsWorkflow(storyLimit, {
    onProgress: (message) => {
      console.log(message);
    }
  });

  console.log(`Fetched ${stories.length} Hacker News stories`);
  console.log(`Found ${candidates.length} security-relevant candidates`);
  console.log(
    `Classified ${classifiedCandidates.length}: analyze=${candidatesForAnalysis.length} monitor=${monitoredCandidates.length} ignore=${ignoredCandidates.length}\n`
  );

  if (candidates.length === 0) {
    console.log("No security-relevant stories found in this batch.");
    return;
  }

  for (const intelligenceItem of intelligenceItems) {
    console.log(formatIntelligenceItem(intelligenceItem));
  }

  if (monitoredCandidates.length > 0) {
    console.log("\nMonitored candidates");

    for (const monitoredCandidate of monitoredCandidates) {
      console.log(formatClassifiedCandidate(monitoredCandidate));
    }
  }
}

/** Parses the optional story limit argument and caps it to a small demo-friendly batch. */
export function parseStoryLimit(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_STORY_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_STORY_LIMIT;
  }

  return Math.min(parsed, MAX_STORY_LIMIT);
}

function formatIntelligenceItem(intelligenceItem: IntelligenceItem): string {
  const { candidate } = intelligenceItem;
  const { item } = candidate;

  return [
    item.title,
    `  ${item.url}`,
    `  hnScore=${item.score} author=${item.author} comments=${item.commentsUrl}`,
    `  relevance=${candidate.relevanceScore} signals=${candidate.matchedSignals.join(", ")}`,
    `  analyst=${intelligenceItem.analyzedBy} alert=${intelligenceItem.analysis.alertLevel} confidence=${intelligenceItem.analysis.confidence}`,
    `  summary=${intelligenceItem.analysis.summary}`,
    `  securityAngle=${intelligenceItem.analysis.securityAngle}`,
    `  audience=${intelligenceItem.analysis.affectedAudience}`
  ].join("\n");
}

function formatClassifiedCandidate(classifiedCandidate: ClassifiedCandidate): string {
  const { candidate } = classifiedCandidate;

  return [
    `${candidate.item.title}`,
    `  decision=${classifiedCandidate.decision} confidence=${classifiedCandidate.confidence}`,
    `  rationale=${classifiedCandidate.rationale}`,
    `  ${candidate.item.url}`
  ].join("\n");
}
