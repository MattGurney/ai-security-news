import { runNewsWorkflow } from "./workflow/newsGraph.js";

const DEFAULT_STORY_LIMIT = 10;

async function main(): Promise<void> {
  const storyLimit = parseStoryLimit(process.argv[2]);
  const { stories, candidates } = await runNewsWorkflow(storyLimit);

  console.log(`Fetched ${stories.length} Hacker News stories`);
  console.log(`Found ${candidates.length} security-relevant candidates\n`);

  if (candidates.length === 0) {
    console.log("No security-relevant stories found in this batch.");
    return;
  }

  for (const candidate of candidates) {
    const { item } = candidate;

    console.log(`${item.title}`);
    console.log(`  ${item.url}`);
    console.log(`  hnScore=${item.score} author=${item.author} comments=${item.commentsUrl}`);
    console.log(`  relevance=${candidate.relevanceScore} signals=${candidate.matchedSignals.join(", ")}`);
    console.log(`  reason=${candidate.reason}`);
  }
}

function parseStoryLimit(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_STORY_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_STORY_LIMIT;
  }

  return Math.min(parsed, 50);
}

await main();
