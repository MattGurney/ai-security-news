import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { AnalystAgent } from "../agents/analystAgent.js";
import { ClassifierAgent } from "../agents/classifierAgent.js";
import { SecurityFilterAgent } from "../agents/securityFilterAgent.js";
import { HackerNewsClient } from "../hn/hackerNewsClient.js";
import type { ClassifiedCandidate, IntelligenceItem, NewsItem, SecurityCandidate } from "../types.js";

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
  classifiedCandidates: Annotation<ClassifiedCandidate[]>({
    reducer: (_current, update) => update,
    default: () => []
  }),
  candidatesForAnalysis: Annotation<SecurityCandidate[]>({
    reducer: (_current, update) => update,
    default: () => []
  }),
  monitoredCandidates: Annotation<ClassifiedCandidate[]>({
    reducer: (_current, update) => update,
    default: () => []
  }),
  ignoredCandidates: Annotation<ClassifiedCandidate[]>({
    reducer: (_current, update) => update,
    default: () => []
  }),
  intelligenceItems: Annotation<IntelligenceItem[]>({
    reducer: (_current, update) => update,
    default: () => []
  })
});

const FETCH_STORIES = "fetchStories";
const FILTER_SECURITY_CANDIDATES = "filterSecurityCandidates";
const CLASSIFY_CANDIDATES = "classifyCandidates";
const ANALYZE_CANDIDATES = "analyzeCandidates";
const PUBLISH_CANDIDATES = "publishCandidates";

const NEWS_WORKFLOW_TOPOLOGY = {
  edges: [
    { from: START, to: FETCH_STORIES },
    { from: FETCH_STORIES, to: FILTER_SECURITY_CANDIDATES },
    { from: FILTER_SECURITY_CANDIDATES, to: CLASSIFY_CANDIDATES },
    { from: ANALYZE_CANDIDATES, to: PUBLISH_CANDIDATES },
    { from: PUBLISH_CANDIDATES, to: END }
  ],
  conditionalEdges: [
    {
      from: CLASSIFY_CANDIDATES,
      to: ANALYZE_CANDIDATES,
      label: "has candidates for deep analysis"
    },
    { from: CLASSIFY_CANDIDATES, to: PUBLISH_CANDIDATES, label: "triage only" }
  ]
} as const;

export type NewsGraphStateType = typeof NewsGraphState.State;

/** Injectable workflow collaborators used by tests and future agent variants. */
export interface NewsWorkflowDependencies {
  hackerNewsClient?: Pick<HackerNewsClient, "fetchTopStories">;
  securityFilterAgent?: Pick<SecurityFilterAgent, "findCandidates">;
  classifierAgent?: Pick<ClassifierAgent, "classifyCandidates">;
  analystAgent?: Pick<AnalystAgent, "analyzeCandidates">;
  onProgress?: (message: string) => void;
  onPublish?: (state: NewsGraphStateType) => void;
}

/** Creates the LangGraph workflow that coordinates fetching, filtering, analysis, and publishing. */
export function createNewsWorkflow(dependencies: NewsWorkflowDependencies = {}) {
  const nodes = createNewsWorkflowNodes(dependencies);

  return new StateGraph(NewsGraphState)
    .addNode(FETCH_STORIES, nodes.fetchStories)
    .addNode(FILTER_SECURITY_CANDIDATES, nodes.filterSecurityCandidates)
    .addNode(CLASSIFY_CANDIDATES, nodes.classifyCandidates)
    .addNode(ANALYZE_CANDIDATES, nodes.analyzeCandidates)
    .addNode(PUBLISH_CANDIDATES, nodes.publishCandidates)
    .addEdge(START, FETCH_STORIES)
    .addEdge(FETCH_STORIES, FILTER_SECURITY_CANDIDATES)
    .addEdge(FILTER_SECURITY_CANDIDATES, CLASSIFY_CANDIDATES)
    .addConditionalEdges(CLASSIFY_CANDIDATES, routeAfterClassification, {
      analyzeCandidates: ANALYZE_CANDIDATES,
      publishCandidates: PUBLISH_CANDIDATES
    })
    .addEdge(ANALYZE_CANDIDATES, PUBLISH_CANDIDATES)
    .addEdge(PUBLISH_CANDIDATES, END)
    .compile();
}

function createNewsWorkflowNodes(dependencies: NewsWorkflowDependencies) {
  const hackerNewsClient = dependencies.hackerNewsClient ?? new HackerNewsClient();
  const securityFilterAgent = dependencies.securityFilterAgent ?? new SecurityFilterAgent();
  const classifierAgent = dependencies.classifierAgent ?? new ClassifierAgent();
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
    classifyCandidates: async (state: NewsGraphStateType) => {
      dependencies.onProgress?.(`Classifying ${state.candidates.length} candidates for routing...`);

      const classifiedCandidates = await classifierAgent.classifyCandidates(state.candidates);

      return {
        classifiedCandidates,
        candidatesForAnalysis: classifiedCandidates
          .filter((candidate) => candidate.decision === "analyze")
          .map((candidate) => candidate.candidate),
        monitoredCandidates: classifiedCandidates.filter((candidate) => candidate.decision === "monitor"),
        ignoredCandidates: classifiedCandidates.filter((candidate) => candidate.decision === "ignore")
      };
    },
    analyzeCandidates: async (state: NewsGraphStateType) => {
      dependencies.onProgress?.(`Analyzing ${state.candidatesForAnalysis.length} routed candidates...`);

      return {
        intelligenceItems: await analystAgent.analyzeCandidates(state.candidatesForAnalysis)
      };
    },
    publishCandidates: (state: NewsGraphStateType) => {
      dependencies.onProgress?.("Publishing intelligence items...");
      dependencies.onPublish?.(state);

      return {};
    }
  };
}

function routeAfterClassification(state: NewsGraphStateType): "analyzeCandidates" | "publishCandidates" {
  return state.candidatesForAnalysis.length > 0 ? "analyzeCandidates" : "publishCandidates";
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
    [FETCH_STORIES, "Fetcher Agent\\nHN API"],
    [FILTER_SECURITY_CANDIDATES, "Deterministic Candidate Filter\\nrecall-oriented"],
    [CLASSIFY_CANDIDATES, "Weak Classifier Agent\\nignore | monitor | analyze"],
    [ANALYZE_CANDIDATES, "Strong Analyst Agent\\nLLM or fallback"],
    [PUBLISH_CANDIDATES, "Publisher\\nCLI intelligence feed"]
  ]);

  const lines = ["flowchart TD"];

  for (const { from, to } of NEWS_WORKFLOW_TOPOLOGY.edges) {
    lines.push(`  ${nodeId(from)}["${labels.get(from) ?? from}"] --> ${nodeId(to)}["${labels.get(to) ?? to}"]`);
  }

  for (const { from, to, label } of NEWS_WORKFLOW_TOPOLOGY.conditionalEdges) {
    lines.push(`  ${nodeId(from)}["${labels.get(from) ?? from}"] -->|${label}| ${nodeId(to)}["${labels.get(to) ?? to}"]`);
  }

  return lines.join("\n");
}

function nodeId(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9_]/g, "_");
}
