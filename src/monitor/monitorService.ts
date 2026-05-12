import { HackerNewsClient } from "../hn/hackerNewsClient.js";
import { appendIntelligenceJsonl } from "../storage/jsonlWriter.js";
import { NewsStore } from "../storage/newsStore.js";
import type { NewsGraphStateType, NewsWorkflowDependencies } from "../workflow/newsGraph.js";
import { runNewsWorkflowForStories } from "../workflow/newsGraph.js";

export interface MonitorOptions {
  storyLimit: number;
  intervalSeconds: number;
  once: boolean;
  dbPath: string;
  jsonlPath: string;
  onProgress?: (message: string) => void;
}

/** Runs the proactive polling loop around the LangGraph intelligence workflow. */
export class MonitorService {
  private readonly hackerNewsClient: HackerNewsClient;
  private readonly workflowDependencies: NewsWorkflowDependencies;

  constructor(workflowDependencies: NewsWorkflowDependencies = {}) {
    this.hackerNewsClient = new HackerNewsClient();
    this.workflowDependencies = workflowDependencies;
  }

  /** Starts polling Hacker News, deduping seen stories, and persisting outputs. */
  async run(options: MonitorOptions): Promise<void> {
    const store = await NewsStore.open({ dbPath: options.dbPath });

    try {
      do {
        await this.runOnce(store, options);

        if (!options.once) {
          options.onProgress?.(`Sleeping for ${options.intervalSeconds} seconds...`);
          await sleep(options.intervalSeconds * 1000);
        }
      } while (!options.once);
    } finally {
      await store.persist();
      store.close();
    }
  }

  private async runOnce(store: NewsStore, options: MonitorOptions): Promise<void> {
    options.onProgress?.(`Polling Hacker News for ${options.storyLimit} stories...`);

    const stories = await this.hackerNewsClient.fetchTopStories(options.storyLimit);
    const unseenStories = store.findUnseenStories(stories);

    options.onProgress?.(`Fetched ${stories.length} stories; ${unseenStories.length} are new.`);
    store.markStoriesSeen(stories);

    if (unseenStories.length === 0) {
      await store.persist();
      options.onProgress?.("No new stories to analyze.");
      return;
    }

    const workflowDependencies: NewsWorkflowDependencies =
      options.onProgress === undefined
        ? this.workflowDependencies
        : {
            ...this.workflowDependencies,
            onProgress: options.onProgress
          };

    const result = await runNewsWorkflowForStories(unseenStories, workflowDependencies);

    await persistResult(store, options.jsonlPath, result);
    await store.persist();

    options.onProgress?.(`Stored ${result.intelligenceItems.length} intelligence items.`);
  }
}

async function persistResult(store: NewsStore, jsonlPath: string, result: NewsGraphStateType): Promise<void> {
  store.saveIntelligenceItems(result.intelligenceItems);
  await appendIntelligenceJsonl(jsonlPath, result.intelligenceItems);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
