import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { IntelligenceItem } from "../types.js";

/** Appends intelligence items as newline-delimited JSON for easy demo inspection. */
export async function appendIntelligenceJsonl(path: string, items: IntelligenceItem[]): Promise<void> {
  if (items.length === 0) {
    return;
  }

  await mkdir(dirname(path), { recursive: true });

  const lines = items.map((item) => JSON.stringify(toJsonRecord(item))).join("\n");
  await appendFile(path, `${lines}\n`);
}

function toJsonRecord(item: IntelligenceItem): object {
  return {
    storyId: item.candidate.item.id,
    title: item.candidate.item.title,
    url: item.candidate.item.url,
    commentsUrl: item.candidate.item.commentsUrl,
    relevanceScore: item.candidate.relevanceScore,
    matchedSignals: item.candidate.matchedSignals,
    analyzedBy: item.analyzedBy,
    analysis: item.analysis,
    writtenAt: new Date().toISOString()
  };
}
