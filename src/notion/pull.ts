import fs from "node:fs";
import path from "node:path";
import type { Client } from "@notionhq/client";
import { getLatestRow } from "./query.js";
import { sha256, isUnchanged } from "../utils/checksum.js";
import type { NotionRow } from "../config/types.js";

export interface PullOptions {
  project: string;
  file: string;
  databaseId: string;
  cwd?: string;
}

export interface PullNotionResult {
  outcome: "written" | "unchanged" | "not_found";
  row?: NotionRow;
}

export async function pullDoc(
  client: Client,
  opts: PullOptions
): Promise<PullNotionResult> {
  const { project, file, databaseId, cwd = process.cwd() } = opts;

  const row = await getLatestRow(client, databaseId, project, file);
  if (!row) return { outcome: "not_found" };

  const localPath = path.join(cwd, file);
  const localExists = fs.existsSync(localPath);

  if (localExists) {
    const localContent = fs.readFileSync(localPath, "utf-8");
    if (isUnchanged(localContent, row.checksum)) {
      return { outcome: "unchanged", row };
    }
  }

  // Write content to disk, creating parent dirs if needed
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, row.content, "utf-8");

  return { outcome: "written", row };
}
