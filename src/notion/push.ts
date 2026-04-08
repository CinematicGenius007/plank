import type { Client } from "@notionhq/client";
import { chunkContent, getTitlePropertyName } from "./client.js";
import { getNextVersion, getLatestRow } from "./query.js";
import { sha256, isUnchanged } from "../utils/checksum.js";
import type { GlobalConfig, NotionRow } from "../config/types.js";

export interface PushOptions {
  project: string;
  file: string;
  title: string;
  content: string;
  databaseId: string;
  message?: string;
}

export interface PushNotionResult {
  outcome: "pushed" | "skipped";
  version?: number;
  row?: NotionRow;
}

export async function pushDoc(
  client: Client,
  config: GlobalConfig,
  opts: PushOptions
): Promise<PushNotionResult> {
  const { project, file, title, content, databaseId, message } = opts;
  const checksum = sha256(content);

  // Check if content has changed since last push
  const latest = await getLatestRow(client, databaseId, project, file);
  if (latest && isUnchanged(content, latest.checksum)) {
    return { outcome: "skipped", version: latest.version, row: latest };
  }

  const version = await getNextVersion(client, databaseId, project, file);
  const titlePropName = await getTitlePropertyName(client, databaseId);
  const pushedAt = new Date().toISOString();

  // Create the page with metadata properties
  const page = await client.pages.create({
    parent: { database_id: databaseId },
    properties: {
      [titlePropName]: {
        title: [{ text: { content: title } }],
      },
      project: {
        select: { name: project },
      },
      file: {
        rich_text: [{ text: { content: file } }],
      },
      version: {
        number: version,
      },
      pushed_at: {
        date: { start: pushedAt },
      },
      checksum: {
        rich_text: [{ text: { content: checksum } }],
      },
      ...(message
        ? { message: { rich_text: [{ text: { content: message } }] } }
        : {}),
    },
  });

  // Store content in page body as code blocks (handles large files)
  const chunks = chunkContent(content);
  await client.blocks.children.append({
    block_id: page.id,
    children: chunks.map((chunk) => ({
      type: "code" as const,
      code: {
        rich_text: [{ type: "text" as const, text: { content: chunk } }],
        language: "markdown" as const,
      },
    })),
  });

  const row: NotionRow = {
    pageId: page.id,
    title,
    project,
    file,
    version,
    content,
    pushedAt,
    message,
    checksum,
  };

  return { outcome: "pushed", version, row };
}
