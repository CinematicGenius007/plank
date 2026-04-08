// ── .planrc ──────────────────────────────────────────────────────────────────

export interface DocEntry {
  file: string;   // local path relative to project root (e.g. "ARCHON.md")
  title: string;  // human-readable label shown in Notion (e.g. "Archon Architecture")
}

export interface PlanRC {
  project: string;
  description?: string;
  docs: DocEntry[];
  notion?: {
    database_id?: string; // overrides global default_database_id for this project
  };
  auto_push?: boolean;
}

// ── ~/.plank/config.json ──────────────────────────────────────────────────────

export interface GlobalConfig {
  notion_token: string;
  default_database_id: string;
}

// ── Notion row (one version of one doc) ──────────────────────────────────────

export interface NotionRow {
  pageId: string;
  title: string;
  project: string;
  file: string;
  version: number;
  content: string;
  pushedAt: string;   // ISO 8601
  message?: string;
  checksum: string;
}

// ── Push result ───────────────────────────────────────────────────────────────

export type PushOutcome = "pushed" | "skipped" | "error";

export interface PushResult {
  file: string;
  title: string;
  version?: number;
  outcome: PushOutcome;
  error?: string;
}

// ── Pull result ───────────────────────────────────────────────────────────────

export type PullOutcome = "written" | "unchanged" | "not_found" | "error";

export interface PullResult {
  file: string;
  title: string;
  version?: number;
  outcome: PullOutcome;
  error?: string;
}
