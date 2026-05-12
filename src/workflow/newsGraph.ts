import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { AnalystAgent } from "../agents/analystAgent.js";
import { SecurityFilterAgent } from "../agents/securityFilterAgent.js";
import { HackerNewsClient } from "../hn/hackerNewsClient.js";
import type { IntelligenceItem, NewsItem, SecurityCandidate } from "../types.js";

const NewsGraphState = Annotation.Root({
  storyLimit: Annotation<number>(),
  stories: Annotation<NewsItem[]>({
    reducer: (_current, update) => update,
    default: () => []
  }),
  candidates: Annotation<SecurityCandidate[]>({
    reducer: (_current, update) => update,
    default: () => []
  }),
  intelligenceItems: Annotation<IntelligenceItem[]>({
    reducer: (_current, update) => update,
    default: () => []
  })
});

export const NEWS_WORKFLOW_NODES = [
  "fetchStories",
  "filterSecurityCandidates",
  "analyzeCandidates",
  "publishCandidates"
] as const;

export const NEWS_WORKFLOW_EDGES = [
  [START, "fetchStories"],
  ["fetchStories", "filterSecurityCandidates"],
  ["filterSecurityCandidates", "analyzeCandidates"],
  ["analyzeCandidates", "publishCandidates"],
  ["publishCandidates", END]
] as const;

export type NewsGraphStateType = typeof NewsGraphState.State;

/** Injectable workflow collaborators used by tests and future agent variants. */
export interface NewsWorkflowDependencies {
  hackerNewsClient?: Pick<HackerNewsClient, "fetchTopStories">;
  securityFilterAgent?: Pick<SecurityFilterAgent, "findCandidates">;
  analystAgent?: Pick<AnalystAgent, "analyzeCandidates">;
  onProgress?: (message: string) => void;
  onPublish?: (state: NewsGraphStateType) => void;
}

/** Creates the LangGraph workflow that coordinates fetching, filtering, analysis, and publishing. */
export function createNewsWorkflow(dependencies: NewsWorkflowDependencies = {}) {
  const nodes = createNewsWorkflowNodes(dependencies);

  return new StateGraph(NewsGraphState)
    .addNode(NEWS_WORKFLOW_NODES[0], nodes.fetchStories)
    .addNode(NEWS_WORKFLOW_NODES[1], nodes.filterSecurityCandidates)
    .addNode(NEWS_WORKFLOW_NODES[2], nodes.analyzeCandidates)
    .addNode(NEWS_WORKFLOW_NODES[3], nodes.publishCandidates)
    .addEdge(NEWS_WORKFLOW_EDGES[0][0], NEWS_WORKFLOW_EDGES[0][1])
    .addEdge(NEWS_WORKFLOW_EDGES[1][0], NEWS_WORKFLOW_EDGES[1][1])
    .addEdge(NEWS_WORKFLOW_EDGES[2][0], NEWS_WORKFLOW_EDGES[2][1])
    .addEdge(NEWS_WORKFLOW_EDGES[3][0], NEWS_WORKFLOW_EDGES[3][1])
    .addEdge(NEWS_WORKFLOW_EDGES[4][0], NEWS_WORKFLOW_EDGES[4][1])
    .compile();
}

function createNewsWorkflowNodes(dependencies: NewsWorkflowDependencies) {
  const hackerNewsClient = dependencies.hackerNewsClient ?? new HackerNewsClient();
  const securityFilterAgent = dependencies.securityFilterAgent ?? new SecurityFilterAgent();
  const analystAgent = dependencies.analystAgent ?? new AnalystAgent();

  return {
    fetchStories: async (state: NewsGraphStateType) => {
      dependencies.onProgress?.(`Fetching ${state.storyLimit} Hacker News stories...`);

      return {
        stories: await hackerNewsClient.fetchTopStories(state.storyLimit)
      };
    },
    filterSecurityCandidates: (state: NewsGraphStateType) => {
      dependencies.onProgress?.(`Filtering ${state.stories.length} stories for security signals...`);

      return {
        candidates: securityFilterAgent.findCandidates(state.stories)
      };
    },
    analyzeCandidates: async (state: NewsGraphStateType) => {
      dependencies.onProgress?.(`Analyzing ${state.candidates.length} security candidates...`);

      return {
        intelligenceItems: await analystAgent.analyzeCandidates(state.candidates)
      };
    },
    publishCandidates: (state: NewsGraphStateType) => {
      dependencies.onProgress?.("Publishing intelligence items...");
      dependencies.onPublish?.(state);

      return {};
    }
  };
}

/** Runs one complete news intelligence graph invocation. */
export async function runNewsWorkflow(
  storyLimit: number,
  dependencies: NewsWorkflowDependencies = {}
): Promise<NewsGraphStateType> {
  const workflow = createNewsWorkflow(dependencies);

  return workflow.invoke({ storyLimit });
}

/** Renders the workflow topology as Mermaid markup for architecture documentation. */
export function renderNewsWorkflowMermaid(): string {
  const labels = new Map<string, string>([
    [START, "Start"],
    [END, "End"],
    ["fetchStories", "Fetcher Agent\\nHN API"],
    ["filterSecurityCandidates", "Deterministic Candidate Filter\\nrecall-oriented"],
    ["analyzeCandidates", "Analyst Agent\\nLLM or fallback"],
    ["publishCandidates", "Publisher\\nCLI intelligence feed"]
  ]);

  const lines = ["flowchart TD"];

  for (const [from, to] of NEWS_WORKFLOW_EDGES) {
    lines.push(`  ${nodeId(from)}["${labels.get(from) ?? from}"] --> ${nodeId(to)}["${labels.get(to) ?? to}"]`);
  }

  return lines.join("\n");
}

function nodeId(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9_]/g, "_");
}
