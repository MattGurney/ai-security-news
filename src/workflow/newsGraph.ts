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

export type NewsGraphStateType = typeof NewsGraphState.State;

/** Injectable workflow collaborators used by tests and future agent variants. */
export interface NewsWorkflowDependencies {
  hackerNewsClient?: Pick<HackerNewsClient, "fetchTopStories">;
  securityFilterAgent?: Pick<SecurityFilterAgent, "findCandidates">;
  analystAgent?: Pick<AnalystAgent, "analyzeCandidates">;
  onPublish?: (state: NewsGraphStateType) => void;
}

/** Creates the LangGraph workflow that coordinates fetching, filtering, analysis, and publishing. */
export function createNewsWorkflow(dependencies: NewsWorkflowDependencies = {}) {
  const nodes = createNewsWorkflowNodes(dependencies);

  return new StateGraph(NewsGraphState)
    .addNode("fetchStories", nodes.fetchStories)
    .addNode("filterSecurityCandidates", nodes.filterSecurityCandidates)
    .addNode("analyzeCandidates", nodes.analyzeCandidates)
    .addNode("publishCandidates", nodes.publishCandidates)
    .addEdge(START, "fetchStories")
    .addEdge("fetchStories", "filterSecurityCandidates")
    .addEdge("filterSecurityCandidates", "analyzeCandidates")
    .addEdge("analyzeCandidates", "publishCandidates")
    .addEdge("publishCandidates", END)
    .compile();
}

function createNewsWorkflowNodes(dependencies: NewsWorkflowDependencies) {
  const hackerNewsClient = dependencies.hackerNewsClient ?? new HackerNewsClient();
  const securityFilterAgent = dependencies.securityFilterAgent ?? new SecurityFilterAgent();
  const analystAgent = dependencies.analystAgent ?? new AnalystAgent();

  return {
    fetchStories: async (state: NewsGraphStateType) => ({
      stories: await hackerNewsClient.fetchTopStories(state.storyLimit)
    }),
    filterSecurityCandidates: (state: NewsGraphStateType) => ({
      candidates: securityFilterAgent.findCandidates(state.stories)
    }),
    analyzeCandidates: async (state: NewsGraphStateType) => ({
      intelligenceItems: await analystAgent.analyzeCandidates(state.candidates)
    }),
    publishCandidates: (state: NewsGraphStateType) => {
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
