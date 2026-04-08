import { Client, isFullDataSource } from "@notionhq/client";
import type { GlobalConfig } from "../config/types.js";

let _client: Client | null = null;
let _titlePropCache: Map<string, string> = new Map();

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
