export interface NewsItem {
  id: number;
  title: string;
  url: string;
  source: "hacker-news";
  author: string;
  score: number;
  commentsUrl: string;
  publishedAt: Date;
}

export interface SecurityCandidate {
  item: NewsItem;
  relevanceScore: number;
  matchedSignals: string[];
  reason: string;
}
