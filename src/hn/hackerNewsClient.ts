import type { NewsItem } from "../types.js";

const HN_BASE_URL = "https://hacker-news.firebaseio.com/v0";
const HN_ITEM_URL = "https://news.ycombinator.com/item";

interface HackerNewsStory {
  by?: unknown;
  id?: unknown;
  score?: unknown;
  time?: unknown;
  title?: unknown;
  type?: unknown;
  url?: unknown;
}

export interface HackerNewsClientOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/** Fetches and normalizes stories from the Hacker News Firebase API. */
export class HackerNewsClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: HackerNewsClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? HN_BASE_URL;
  }

  /** Fetches top story identifiers from Hacker News. */
  async fetchTopStoryIds(limit: number): Promise<number[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/topstories.json`);

    if (!response.ok) {
      throw new Error(`Failed to fetch Hacker News story ids: ${response.status}`);
    }

    const payload: unknown = await response.json();

    if (!Array.isArray(payload)) {
      throw new Error("Unexpected Hacker News story id response");
    }

    return payload
      .filter((id): id is number => Number.isInteger(id))
      .slice(0, limit);
  }

  /** Fetches one Hacker News item and returns it when it is a valid story. */
  async fetchStory(id: number): Promise<NewsItem | null> {
    const response = await this.fetchImpl(`${this.baseUrl}/item/${id}.json`);

    if (!response.ok) {
      throw new Error(`Failed to fetch Hacker News item ${id}: ${response.status}`);
    }

    const payload: unknown = await response.json();
    return normalizeHackerNewsStory(payload);
  }

  /** Fetches and normalizes a batch of top Hacker News stories. */
  async fetchTopStories(limit = 10): Promise<NewsItem[]> {
    const ids = await this.fetchTopStoryIds(limit);
    const stories = await Promise.all(ids.map((id) => this.fetchStory(id)));

    return stories.filter((story): story is NewsItem => story !== null);
  }
}

/** Converts raw Hacker News item JSON into the internal news item shape. */
export function normalizeHackerNewsStory(payload: unknown): NewsItem | null {
  if (!isHackerNewsStory(payload) || payload.type !== "story") {
    return null;
  }

  if (typeof payload.id !== "number" || !Number.isInteger(payload.id)) {
    return null;
  }

  if (typeof payload.title !== "string" || typeof payload.time !== "number") {
    return null;
  }

  const storyUrl =
    typeof payload.url === "string" && payload.url.length > 0
      ? payload.url
      : `${HN_ITEM_URL}?id=${payload.id}`;

  return {
    id: payload.id,
    title: payload.title,
    url: storyUrl,
    source: "hacker-news",
    author: typeof payload.by === "string" ? payload.by : "unknown",
    score: typeof payload.score === "number" ? payload.score : 0,
    commentsUrl: `${HN_ITEM_URL}?id=${payload.id}`,
    publishedAt: new Date(payload.time * 1000)
  };
}

function isHackerNewsStory(payload: unknown): payload is HackerNewsStory {
  return typeof payload === "object" && payload !== null;
}
