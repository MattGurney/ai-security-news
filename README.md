# AI Security News

A TypeScript starting point for an AI-based security news feed. The system currently
fetches recent Hacker News stories, runs a deterministic security relevance pass,
and prints candidate intelligence items to the CLI.

## Current Behavior

`npm run dev` fetches top Hacker News stories, scores them for security relevance,
and prints the stories that match security or AI-security signals.

## Commands

```sh
npm run dev
npm run dev -- 5
npm run lint
npm run test
npm run build
npm run check
```

## Progress

- Milestone 1: Added a Hacker News fetcher that normalizes top stories into a
  shared `NewsItem` type.
- Milestone 2: Added a deterministic `SecurityFilterAgent` that identifies likely
  security-relevant stories and explains which signals matched.
