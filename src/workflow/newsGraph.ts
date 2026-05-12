import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { SecurityFilterAgent } from "../agents/securityFilterAgent.js";
import { HackerNewsClient } from "../hn/hackerNewsClient.js";
import type { NewsItem, SecurityCandidate } from "../types.js";

const NewsGraphState = Annotation.Root({
  storyLimit: Annotation<number>(),
  stories: Annotation<NewsItem[]>({
    reducer: (_current, update) => update,
    default: () => []
  }),
  candidates: Annotation<SecurityCandidate[]>({
    reducer: (_current, update) => update,
    default: () => []
  })
});

export type NewsGraphStateType = typeof NewsGraphState.State;

export interface NewsWorkflowDependencies {
  hackerNewsClient?: Pick<HackerNewsClient, "fetchTopStories">;
  securityFilterAgent?: Pick<SecurityFilterAgent, "findCandidates">;
  onPublish?: (state: NewsGraphStateType) => void;
}

export function createNewsWorkflow(dependencies: NewsWorkflowDependencies = {}) {
  const hackerNewsClient = dependencies.hackerNewsClient ?? new HackerNewsClient();
  const securityFilterAgent = dependencies.securityFilterAgent ?? new SecurityFilterAgent();

  return new StateGraph(NewsGraphState)
    .addNode("fetchStories", async (state) => {
      const stories = await hackerNewsClient.fetchTopStories(state.storyLimit);

      return { stories };
    })
    .addNode("filterSecurityCandidates", (state) => {
      const candidates = securityFilterAgent.findCandidates(state.stories);

      return { candidates };
    })
    .addNode("publishCandidates", (state) => {
      dependencies.onPublish?.(state);

      return {};
    })
    .addEdge(START, "fetchStories")
    .addEdge("fetchStories", "filterSecurityCandidates")
    .addEdge("filterSecurityCandidates", "publishCandidates")
    .addEdge("publishCandidates", END)
    .compile();
}

export async function runNewsWorkflow(
  storyLimit: number,
  dependencies: NewsWorkflowDependencies = {}
): Promise<NewsGraphStateType> {
  const workflow = createNewsWorkflow(dependencies);

  return workflow.invoke({ storyLimit });
}
