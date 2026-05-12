import { HackerNewsClient } from "./hn/hackerNewsClient.js";

const DEFAULT_STORY_LIMIT = 10;

async function main(): Promise<void> {
  const storyLimit = parseStoryLimit(process.argv[2]);
  const client = new HackerNewsClient();
  const stories = await client.fetchTopStories(storyLimit);

  console.log(`Fetched ${stories.length} Hacker News stories\n`);

  for (const story of stories) {
    console.log(`${story.title}`);
    console.log(`  ${story.url}`);
    console.log(`  score=${story.score} author=${story.author} comments=${story.commentsUrl}`);
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
