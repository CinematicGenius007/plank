import { isFullPage } from "@notionhq/client";
import type { Client, PageObjectResponse } from "@notionhq/client";
import type { NotionRow } from "../config/types.js";

// ── Property extractors ───────────────────────────────────────────────────────

function getText(page: PageObjectResponse, prop: string): string {
  const p = page.properties[prop];
  if (!p) return "";
  if (p.type === "rich_text") return p.rich_text.map((r) => r.plain_text).join("");
  if (p.type === "title") return p.title.map((r) => r.plain_text).join("");
  return "";
}

function getNumber(page: PageObjectResponse, prop: string): number {
  const p = page.properties[prop];
  if (p?.type === "number" && p.number !== null) return p.number;
  return 0;
}

function getSelect(page: PageObjectResponse, prop: string): string {
  const p = page.properties[prop];
  if (p?.type === "select") return p.select?.name ?? "";
  return "";
}

function getDate(page: PageObjectResponse, prop: string): string {
  const p = page.properties[prop];
  if (p?.type === "date") return p.date?.start ?? "";
  return "";
}

export function getTitleText(page: PageObjectResponse): string {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "title") return prop.title.map((r) => r.plain_text).join("");
  }
  return "";
}

// ── Content retrieval ─────────────────────────────────────────────────────────

export async function getPageContent(client: Client, pageId: string): Promise<string> {
  const blocks = await client.blocks.children.list({ block_id: pageId });
  const parts: string[] = [];

  for (const block of blocks.results) {
    if ("type" in block && block.type === "code") {
      const text = block.code.rich_text.map((r) => r.plain_text).join("");
      parts.push(text);
    }
  }

  return parts.join("");
}

// ── Row mapping ───────────────────────────────────────────────────────────────

export async function pageToRow(client: Client, page: PageObjectResponse): Promise<NotionRow> {
  const content = await getPageContent(client, page.id);
  return {
    pageId: page.id,
    title: getTitleText(page),
    project: getSelect(page, "project"),
    file: getText(page, "file"),
    version: getNumber(page, "version"),
    content,
    pushedAt: getDate(page, "pushed_at"),
    message: getText(page, "message") || undefined,
    checksum: getText(page, "checksum"),
  };
}

// ── Shared query helper ───────────────────────────────────────────────────────

type DataSourceQueryParams = Parameters<Client["dataSources"]["query"]>[0];

async function queryDataSource(
  client: Client,
  params: DataSourceQueryParams
): Promise<PageObjectResponse[]> {
  const response = await client.dataSources.query(params);
  return response.results.filter(isFullPage) as PageObjectResponse[];
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/** All rows for a project, sorted descending by version. */
export async function queryProject(
  client: Client,
  databaseId: string,
  project: string
): Promise<PageObjectResponse[]> {
  return queryDataSource(client, {
    data_source_id: databaseId,
    filter: {
      property: "project",
      select: { equals: project },
    },
    sorts: [{ property: "version", direction: "descending" }],
  });
}

/** Latest row for a specific project + file. Returns null if none. */
export async function getLatestRow(
  client: Client,
  databaseId: string,
  project: string,
  file: string
): Promise<NotionRow | null> {
  const pages = await queryDataSource(client, {
    data_source_id: databaseId,
    filter: {
      and: [
        { property: "project", select: { equals: project } },
        { property: "file", rich_text: { equals: file } },
      ],
    },
    sorts: [{ property: "version", direction: "descending" }],
    page_size: 1,
  });

  if (pages.length === 0) return null;
  return pageToRow(client, pages[0]);
}

/** Next version number for a project + file. */
export async function getNextVersion(
  client: Client,
  databaseId: string,
  project: string,
  file: string
): Promise<number> {
  const latest = await getLatestRow(client, databaseId, project, file);
  return (latest?.version ?? 0) + 1;
}

/** Latest checksum for a project + file without fetching content. */
export async function getLatestChecksum(
  client: Client,
  databaseId: string,
  project: string,
  file: string
): Promise<string | null> {
  const pages = await queryDataSource(client, {
    data_source_id: databaseId,
    filter: {
      and: [
        { property: "project", select: { equals: project } },
        { property: "file", rich_text: { equals: file } },
      ],
    },
    sorts: [{ property: "version", direction: "descending" }],
    page_size: 1,
  });

  if (pages.length === 0) return null;
  return getText(pages[0], "checksum") || null;
}

/** Version history for a project + file (newest first, no content fetch). */
export async function getHistory(
  client: Client,
  databaseId: string,
  project: string,
  file: string,
  limit = 10
): Promise<Omit<NotionRow, "content">[]> {
  const pages = await queryDataSource(client, {
    data_source_id: databaseId,
    filter: {
      and: [
        { property: "project", select: { equals: project } },
        { property: "file", rich_text: { equals: file } },
      ],
    },
    sorts: [{ property: "version", direction: "descending" }],
    page_size: limit,
  });

  return pages.map((page) => ({
    pageId: page.id,
    title: getTitleText(page),
    project: getSelect(page, "project"),
    file: getText(page, "file"),
    version: getNumber(page, "version"),
    pushedAt: getDate(page, "pushed_at"),
    message: getText(page, "message") || undefined,
    checksum: getText(page, "checksum"),
  }));
}

/** All distinct file+title pairs for a project (for clone reconstruction). */
export async function getProjectDocs(
  client: Client,
  databaseId: string,
  project: string
): Promise<{ file: string; title: string }[]> {
  const pages = await queryProject(client, databaseId, project);
  const seen = new Map<string, string>();
  for (const page of pages) {
    const file = getText(page, "file");
    const title = getTitleText(page);
    if (file && !seen.has(file)) seen.set(file, title);
  }
  return Array.from(seen.entries()).map(([file, title]) => ({ file, title }));
}

/** All distinct project names in the database. */
export async function listProjects(
  client: Client,
  databaseId: string
): Promise<string[]> {
  const pages = await queryDataSource(client, { data_source_id: databaseId });
  const names = new Set<string>();
  for (const page of pages) {
    const name = getSelect(page, "project");
    if (name) names.add(name);
  }
  return Array.from(names).sort();
}
