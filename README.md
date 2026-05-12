# AI Security News

A TypeScript starting point for an AI-based security news feed. The system currently
uses a LangGraph workflow to fetch recent Hacker News stories, run a deterministic
security relevance pass, analyze candidates with an LLM when configured, and print
candidate intelligence items to the CLI.

## Current Behavior

`npm run dev` fetches top Hacker News stories, scores them for security relevance,
analyzes matching candidates, and prints the stories that match security or
AI-security signals. The work is orchestrated through a LangGraph graph with
fetch, filter, analyze, and publish nodes.

If `OPENAI_API_KEY` is present, the analyst node uses an OpenAI chat model through
LangChain structured output. Without a key, the analyst node emits deterministic
fallback analysis so the demo still runs locally.

## Setup

```sh
cp .env.example .env
```

Set `OPENAI_API_KEY` in `.env` to enable LLM analysis. `OPENAI_MODEL` is optional
and defaults to `gpt-5.5`.

## Commands

```sh
npm run dev
npm run dev -- 5
npm run docs:architecture
npm run lint
npm run test
npm run build
npm run check
```

## Architecture

The AI and data-flow design is documented in `docs/architecture.html`. Regenerate
it with `npm run docs:architecture` after graph or data-object changes.

## Progress

- Milestone 1: Added a Hacker News fetcher that normalizes top stories into a
  shared `NewsItem` type.
- Milestone 2: Added a deterministic `SecurityFilterAgent` that identifies likely
  security-relevant stories and explains which signals matched.
- Milestone 3: Added a LangGraph workflow that coordinates fetching, filtering,
  and publishing as explicit graph nodes.
- Milestone 4: Added an `AnalystAgent` that uses OpenAI through LangChain
  structured output when configured, with deterministic fallback analysis when no
  API key is present.
