/**
 * SOURCE OF TRUTH: specs/08-data-provider-integration/shared-types.ts
 * (investment-thesis-tracker repo)
 *
 * Canonical cross-application types for the Data Provider integration.
 * There is NO shared package: copy this file into each app and keep this
 * header comment. If a contract changes, update the spec copy first, then
 * re-copy into every consumer.
 *
 * Consumers: data provider (Bun), thesis tracker (Express), mapping agent (eve).
 * All timestamps are ISO 8601 UTC strings.
 */

// ── Article identity ─────────────────────────────────────────────────

/** `<source>:<native-id>`, e.g. "ft:478fe638-84d5-4eab-a2c5-5b43ec106bdf" */
export type ArticleKey = string;

export type ArticleSource = "ft"; // widen as providers are added

export function makeArticleKey(source: string, id: string): ArticleKey {
  return `${source}:${id}`;
}

export function parseArticleKey(key: ArticleKey): { source: string; id: string } {
  const i = key.indexOf(":");
  if (i <= 0 || i === key.length - 1) throw new Error(`Malformed article key: ${key}`);
  return { source: key.slice(0, i), id: key.slice(i + 1) };
}

/** Filename-safe form: colon → double underscore. */
export function articleKeyToFilenamePart(key: ArticleKey): string {
  return key.replace(":", "__");
}

/** Deterministic document filename for a mapped article (idempotency key). */
export function mappedArticleFilename(key: ArticleKey): string {
  return `article__${articleKeyToFilenamePart(key)}.md`;
}

// ── Articles ─────────────────────────────────────────────────────────

/** Teaser-level metadata; what crawls collect and list endpoints return. */
export interface ArticleTeaser {
  key: ArticleKey;
  source: string;
  section: string;
  headline: string;
  standfirst: string | null;
  category: string | null;
  author: string | null;
  url: string;
  publishedAt: string | null; // usually null until the body is fetched
  firstSeenAt: string;
}

/** Full article: teaser + cached body state. */
export interface Article extends ArticleTeaser {
  body: string | null;
  bodyFetchedAt: string | null;
}

// ── Provider HTTP / MCP payloads ─────────────────────────────────────

export interface ListArticlesResponse {
  articles: ArticleTeaser[];
  /** Max firstSeenAt in this page; pass back as `since` to page. Null when empty. */
  nextCursor: string | null;
}

export interface SearchArticlesResponse {
  articles: ArticleTeaser[];
}

export interface CrawlRun {
  id: number;
  source: string;
  startedAt: string;
  finishedAt: string | null; // null while running
  articlesSeen: number;
  articlesNew: number;
  error: string | null;
}

export interface ProviderHealth {
  status: "ok";
  articleCount: number;
  bodyCount: number;
  sources: Array<{
    source: string;
    lastRun: CrawlRun | null;
  }>;
}

/** Error shape for both HTTP APIs. `detail` only on provider 502 body-fetch errors. */
export interface ApiError {
  error: string;
  detail?: string;
}

// ── Tracker payloads the mapper consumes ─────────────────────────────

export interface TrackerHolding {
  id: string; // uuid
  ticker: string;
  companyName: string;
  direction: "long" | "short";
  benchmark: string;
  status: "active" | "closed" | "paused";
  createdAt: string;
  latestImpact: "strengthened" | "weakened" | "unchanged" | null;
  lastUpdated: string | null;
  weakenedStreak: boolean;
}

export interface TrackerThesis {
  id: string;
  holdingId: string;
  content: string | null; // markdown; mapper uses the first 1500 chars as excerpt
  sources: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface TrackerDocument {
  id: string;
  holdingId: string;
  /** Original upload filename — the idempotency check compares against this. */
  filename: string;
  filePath: string;
  fileType: "PDF" | "DOCX" | "MD" | null;
  fileSize: number | null;
  createdAt: string;
}

// ── Mapped-article document frontmatter ──────────────────────────────

/** YAML frontmatter fields of an uploaded article document (contracts.md §5). */
export interface MappedArticleFrontmatter {
  kind: "mapped-article";
  article_key: ArticleKey;
  source: string;
  url: string;
  published_at?: string; // omitted when unknown
  matched_at: string;
  /** LLM's 1-2 sentence, thesis-specific relevance explanation. */
  rationale: string;
}

/** Number of characters of thesis markdown given to the mapping LLM per holding. */
export const THESIS_EXCERPT_CHARS = 1500;
