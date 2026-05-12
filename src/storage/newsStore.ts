import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import initSqlJs from "sql.js";
import type { Database, SqlJsStatic } from "sql.js";

import type { IntelligenceItem, NewsItem } from "../types.js";

export interface NewsStoreOptions {
  dbPath: string;
}

/** Local SQLite-backed state for dedupe and persisted intelligence output. */
export class NewsStore {
  private readonly db: Database;
  private readonly dbPath: string;

  private constructor(db: Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
    this.migrate();
  }

  /** Opens the SQLite database, creating it and its schema when needed. */
  static async open(options: NewsStoreOptions): Promise<NewsStore> {
    const SQL = await loadSqlJs();
    const db = await openDatabase(SQL, options.dbPath);

    return new NewsStore(db, options.dbPath);
  }

  /** Returns only stories that have not been seen in previous monitor runs. */
  findUnseenStories(stories: NewsItem[]): NewsItem[] {
    return stories.filter((story) => !this.hasSeenStory(story.id));
  }

  /** Records fetched stories as seen so later polling cycles can skip them. */
  markStoriesSeen(stories: NewsItem[]): void {
    const statement = this.db.prepare(`
      INSERT OR IGNORE INTO seen_stories (
        id,
        first_seen_at,
        title,
        url,
        source,
        author,
        score,
        comments_url,
        published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    try {
      for (const story of stories) {
        statement.run([
          story.id,
          now,
          story.title,
          story.url,
          story.source,
          story.author,
          story.score,
          story.commentsUrl,
          story.publishedAt.toISOString()
        ]);
      }
    } finally {
      statement.free();
    }
  }

  /** Stores final intelligence items for later inspection. */
  saveIntelligenceItems(items: IntelligenceItem[]): void {
    const statement = this.db.prepare(`
      INSERT INTO intelligence_items (
        story_id,
        created_at,
        decision,
        analyzed_by,
        alert_level,
        confidence,
        summary,
        security_angle,
        affected_audience,
        payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    try {
      for (const item of items) {
        statement.run([
          item.candidate.item.id,
          now,
          "analyze",
          item.analyzedBy,
          item.analysis.alertLevel,
          item.analysis.confidence,
          item.analysis.summary,
          item.analysis.securityAngle,
          item.analysis.affectedAudience,
          JSON.stringify(item)
        ]);
      }
    } finally {
      statement.free();
    }
  }

  /** Writes the in-memory SQLite database back to disk. */
  async persist(): Promise<void> {
    await mkdir(dirname(this.dbPath), { recursive: true });
    await writeFile(this.dbPath, this.db.export());
  }

  close(): void {
    this.db.close();
  }

  private hasSeenStory(id: number): boolean {
    const result = this.db.exec("SELECT 1 FROM seen_stories WHERE id = ? LIMIT 1", [id]);

    return result.length > 0 && result[0] !== undefined && result[0].values.length > 0;
  }

  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS seen_stories (
        id INTEGER PRIMARY KEY,
        first_seen_at TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        source TEXT NOT NULL,
        author TEXT NOT NULL,
        score INTEGER NOT NULL,
        comments_url TEXT NOT NULL,
        published_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS intelligence_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        decision TEXT NOT NULL,
        analyzed_by TEXT NOT NULL,
        alert_level TEXT NOT NULL,
        confidence REAL NOT NULL,
        summary TEXT NOT NULL,
        security_angle TEXT NOT NULL,
        affected_audience TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        FOREIGN KEY (story_id) REFERENCES seen_stories(id)
      );

      CREATE INDEX IF NOT EXISTS idx_intelligence_items_story_id
        ON intelligence_items(story_id);
    `);
  }
}

let sqlJsPromise: Promise<SqlJsStatic> | undefined;

function loadSqlJs(): Promise<SqlJsStatic> {
  sqlJsPromise ??= initSqlJs({
    locateFile: (file) => `node_modules/sql.js/dist/${file}`
  });

  return sqlJsPromise;
}

async function openDatabase(SQL: SqlJsStatic, dbPath: string): Promise<Database> {
  try {
    const data = await readFile(dbPath);

    return new SQL.Database(data);
  } catch (error) {
    if (isMissingFileError(error)) {
      return new SQL.Database();
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
