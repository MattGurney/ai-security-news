# AI Security News

A TypeScript starting point for an AI-based security news feed. The system currently
uses a LangGraph workflow to fetch recent Hacker News stories, run a deterministic
security relevance pass, route candidates through a weak classifier agent, analyze
high-value candidates with an LLM when configured, and print intelligence items to
the CLI.

## Current Behavior

`npm run dev` fetches top Hacker News stories, scores them for security relevance,
classifies matching candidates as `ignore`, `monitor`, or `analyze`, and sends
only `analyze` items to the stronger analyst node. The work is orchestrated
through a LangGraph graph with fetch, filter, classify, route, analyze, and
publish stages.

If `OPENAI_API_KEY` is present, the analyst node uses an OpenAI chat model through
LangChain structured output. Without a key, the analyst node emits deterministic
fallback analysis so the demo still runs locally.

## Setup

```sh
cp .env.example .env
```

Set `OPENAI_API_KEY` in `.env` to enable LLM classification and analysis.
`OPENAI_MODEL` and `OPENAI_CLASSIFIER_MODEL` are optional and default to
`gpt-5.5`.

## Commands

```sh
npm run dev
npm run dev -- 5
npm run monitor
npm run monitor -- --once --limit 500
npm run docs:architecture
npm run lint
npm run test
npm run build
npm run check
```

## Architecture

The AI and data-flow design is documented in `docs/architecture.html`. Regenerate
it with `npm run docs:architecture` after graph or data-object changes.

## Proactive Monitor

Run a continuous polling loop with local SQLite state and JSONL output:

```sh
npm run monitor
```

For a single test cycle:

```sh
npm run monitor -- --once --limit 500 --interval-seconds 300
```

The monitor stores dedupe state in `data/news-monitor.sqlite` and appends emitted
intelligence items to `output/intelligence.jsonl`. Both paths are ignored by Git.

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
- Milestone 5: Added architecture documentation with a generated Mermaid view of
  the LangGraph flow, widened candidate recall, and added scan progress logging.
- Milestone 6: Added a weak `ClassifierAgent` and LangGraph conditional routing
  so only high-value candidates go to the stronger analyst pass.
  During this milestone the graph construction was corrected back to readable
  named nodes after an overly mechanical topology-array approach made the core
  workflow harder to understand.
- Milestone 7: Added proactive monitor mode with SQLite-backed dedupe state and
  JSONL output for locally observable intelligence events.
