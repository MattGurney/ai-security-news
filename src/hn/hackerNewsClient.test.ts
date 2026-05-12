import { describe, expect, it } from "vitest";

import { HackerNewsClient, normalizeHackerNewsStory } from "./hackerNewsClient.js";

describe("normalizeHackerNewsStory", () => {
  it("normalizes a Hacker News story into a NewsItem", () => {
    const story = normalizeHackerNewsStory({
      by: "pg",
      id: 123,
      score: 42,
      time: 1_700_000_000,
      title: "Example security story",
      type: "story",
      url: "https://example.com/security"
    });

    expect(story).toEqual({
      id: 123,
      title: "Example security story",
      url: "https://example.com/security",
      source: "hacker-news",
      author: "pg",
      score: 42,
      commentsUrl: "https://news.ycombinator.com/item?id=123",
      publishedAt: new Date("2023-11-14T22:13:20.000Z")
    });
  });

  it("uses the comments URL when a story has no outbound URL", () => {
    const story = normalizeHackerNewsStory({
      id: 456,
      time: 1_700_000_000,
      title: "Ask HN: Security question",
      type: "story"
    });

    expect(story?.url).toBe("https://news.ycombinator.com/item?id=456");
  });

  it("ignores non-story items", () => {
    expect(
      normalizeHackerNewsStory({
        id: 789,
        time: 1_700_000_000,
        title: "Example comment",
        type: "comment"
      })
    ).toBeNull();
  });
});

describe("HackerNewsClient", () => {
  it("fetches and normalizes top stories", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);

      if (url.endsWith("/topstories.json")) {
        return Response.json([1, 2, "bad-id", 3]);
      }

      if (url.endsWith("/item/1.json")) {
        return Response.json({
          by: "alice",
          id: 1,
          score: 10,
          time: 1_700_000_001,
          title: "First story",
          type: "story",
          url: "https://example.com/first"
        });
      }

      if (url.endsWith("/item/2.json")) {
        return Response.json({
          by: "bob",
          id: 2,
          score: 5,
          time: 1_700_000_002,
          title: "Second story",
          type: "story"
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const client = new HackerNewsClient({
      fetchImpl,
      baseUrl: "https://example.test"
    });

    const stories = await client.fetchTopStories(2);

    expect(stories).toHaveLength(2);
    expect(stories.map((story) => story.title)).toEqual(["First story", "Second story"]);
  });
});
