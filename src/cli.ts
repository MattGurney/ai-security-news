import type { ClassifiedCandidate, IntelligenceItem } from "./types.js";
import { MonitorService } from "./monitor/monitorService.js";
import { runNewsWorkflow } from "./workflow/newsGraph.js";

const DEFAULT_STORY_LIMIT = 10;
const MAX_STORY_LIMIT = 500;
const DEFAULT_MONITOR_INTERVAL_SECONDS = 300;
const DEFAULT_DB_PATH = "data/news-monitor.sqlite";
const DEFAULT_JSONL_PATH = "output/intelligence.jsonl";

/** Runs the command-line workflow for a single Hacker News polling pass. */
export async function runCli(args: string[]): Promise<void> {
  if (args[2] === "monitor") {
    await runMonitorCli(args.slice(3));
    return;
  }

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

/** Runs the proactive monitor loop until interrupted, or once when --once is passed. */
export async function runMonitorCli(args: string[]): Promise<void> {
  const options = parseMonitorOptions(args);
  const monitor = new MonitorService();

  console.log(
    `Starting proactive monitor: limit=${options.storyLimit} interval=${options.intervalSeconds}s db=${options.dbPath} jsonl=${options.jsonlPath}`
  );

  if (options.once) {
    console.log("Running one polling cycle because --once was provided.");
  }

  await monitor.run({
    ...options,
    onProgress: (message) => {
      console.log(message);
    }
  });
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

export function parseMonitorOptions(args: string[]): {
  storyLimit: number;
  intervalSeconds: number;
  once: boolean;
  dbPath: string;
  jsonlPath: string;
} {
  return {
    storyLimit: parseStoryLimit(getFlagValue(args, "--limit")),
    intervalSeconds: parsePositiveInteger(getFlagValue(args, "--interval-seconds"), DEFAULT_MONITOR_INTERVAL_SECONDS),
    once: args.includes("--once"),
    dbPath: getFlagValue(args, "--db") ?? DEFAULT_DB_PATH,
    jsonlPath: getFlagValue(args, "--jsonl") ?? DEFAULT_JSONL_PATH
  };
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

function getFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}
