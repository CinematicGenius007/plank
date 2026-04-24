import { confirm } from "@inquirer/prompts";
import type { Client } from "@notionhq/client";
import {
  REQUIRED_DATA_SOURCE_PROPERTIES,
  createMissingDataSourceProperties,
  getMissingDataSourceProperties,
} from "../notion/client.js";
import { blank, info, success, warn } from "../utils/output.js";

export async function ensurePlankDataSourceSchema(
  client: Client,
  databaseId: string
): Promise<boolean> {
  const required = Object.keys(REQUIRED_DATA_SOURCE_PROPERTIES);
  const missing = await getMissingDataSourceProperties(client, databaseId, required);

  if (missing.length === 0) return true;

  warn(`Notion data source is missing required Plank properties: ${missing.join(", ")}`);
  info("  Required schema:");
  info('    title property (existing Notion title column, any name)');
  info('    project (select), file (rich text), version (number)');
  info('    pushed_at (date), message (rich text), checksum (rich text)');
  blank();

  const shouldCreate = await confirm({
    message: "Create the missing Notion properties now?",
    default: true,
  });

  if (!shouldCreate) {
    warn("Schema setup skipped. Add the missing properties in Notion and try again.");
    return false;
  }

  const created = await createMissingDataSourceProperties(client, databaseId, missing);
  success(`Created Notion properties: ${created.join(", ")}`);
  blank();
  return true;
}
