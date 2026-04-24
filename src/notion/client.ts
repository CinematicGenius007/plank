import { Client, isFullDataSource } from "@notionhq/client";
import type { GlobalConfig } from "../config/types.js";

let _client: Client | null = null;
let _titlePropCache: Map<string, string> = new Map();
let _propertyNameCache: Map<string, Set<string>> = new Map();

export const REQUIRED_DATA_SOURCE_PROPERTIES = {
  project: "select",
  file: "rich_text",
  version: "number",
  pushed_at: "date",
  message: "rich_text",
  checksum: "rich_text",
} as const;

export function getClient(config: GlobalConfig): Client {
  if (!_client) {
    _client = new Client({ auth: config.notion_token });
  }
  return _client;
}

/**
 * Data sources (the v5 equivalent of databases) have exactly one property of
 * type "title". Its name varies (default: "Name") so we discover it dynamically
 * and cache it. Uses dataSources.retrieve() — databases.retrieve() no longer
 * exposes the properties schema in v5.
 */
export async function getTitlePropertyName(
  client: Client,
  databaseId: string
): Promise<string> {
  const cached = _titlePropCache.get(databaseId);
  if (cached) return cached;

  const ds = await client.dataSources.retrieve({ data_source_id: databaseId });
  if (!isFullDataSource(ds)) {
    throw new Error(`Could not retrieve full data source for ${databaseId}.`);
  }

  for (const [name, prop] of Object.entries(ds.properties)) {
    if (prop.type === "title") {
      _titlePropCache.set(databaseId, name);
      return name;
    }
  }

  throw new Error(
    `No title property found in Notion data source ${databaseId}. ` +
      "Ensure the database has a title property."
  );
}

export async function getDataSourcePropertyNames(
  client: Client,
  databaseId: string
): Promise<Set<string>> {
  const cached = _propertyNameCache.get(databaseId);
  if (cached) return cached;

  const ds = await client.dataSources.retrieve({ data_source_id: databaseId });
  if (!isFullDataSource(ds)) {
    throw new Error(`Could not retrieve full data source for ${databaseId}.`);
  }

  const names = new Set(Object.keys(ds.properties));
  _propertyNameCache.set(databaseId, names);
  return names;
}

export async function getMissingDataSourceProperties(
  client: Client,
  databaseId: string,
  required: string[]
): Promise<string[]> {
  const existing = await getDataSourcePropertyNames(client, databaseId);
  return required.filter((name) => !existing.has(name));
}

export async function assertDataSourceProperties(
  client: Client,
  databaseId: string,
  required: string[]
): Promise<void> {
  const missing = await getMissingDataSourceProperties(client, databaseId, required);

  if (missing.length === 0) return;

  throw new Error(
    [
      `Notion data source schema is missing required properties: ${missing.join(", ")}`,
      "Plank expects these properties:",
      '  - one title property (name can vary, e.g. "Name")',
      '  - "project" (select)',
      '  - "file" (rich text)',
      '  - "version" (number)',
      '  - "pushed_at" (date)',
      '  - "message" (rich text, optional but recommended)',
      '  - "checksum" (rich text)',
    ].join("\n")
  );
}

export async function createMissingDataSourceProperties(
  client: Client,
  databaseId: string,
  missing: string[]
): Promise<string[]> {
  const supported = missing.filter((name) => name in REQUIRED_DATA_SOURCE_PROPERTIES);
  if (supported.length === 0) return [];

  const properties: Record<string, object> = {};
  for (const name of supported) {
    const type = REQUIRED_DATA_SOURCE_PROPERTIES[name as keyof typeof REQUIRED_DATA_SOURCE_PROPERTIES];

    switch (type) {
      case "select":
        properties[name] = { select: {} };
        break;
      case "rich_text":
        properties[name] = { rich_text: {} };
        break;
      case "number":
        properties[name] = { number: {} };
        break;
      case "date":
        properties[name] = { date: {} };
        break;
    }
  }

  await client.dataSources.update({
    data_source_id: databaseId,
    properties: properties as Parameters<Client["dataSources"]["update"]>[0]["properties"],
  });

  _propertyNameCache.delete(databaseId);
  return supported;
}

/**
 * Verify the connection and data source access work.
 * Returns the data source title for confirmation output.
 */
export async function verifyConnection(
  config: GlobalConfig,
  databaseId: string
): Promise<string> {
  const client = getClient(config);
  const ds = await client.dataSources.retrieve({ data_source_id: databaseId });
  if (!isFullDataSource(ds)) return databaseId;
  return ds.title.map((t) => t.plain_text).join("") || databaseId;
}

/**
 * Split content into chunks ≤ 2000 chars, breaking on newlines where possible.
 * Used to store large docs as multiple Notion blocks.
 */
export function chunkContent(content: string, maxLen = 2000): string[] {
  if (content.length <= maxLen) return [content];

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > maxLen) {
    const slice = remaining.slice(0, maxLen);
    const lastNewline = slice.lastIndexOf("\n");
    const breakAt = lastNewline > maxLen * 0.5 ? lastNewline + 1 : maxLen;

    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt);
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}
