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
