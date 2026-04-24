import { Command } from "commander";
import { readPlanRC, resolveDbId, findDoc } from "../../config/planrc.js";
import { readGlobalConfig } from "../../config/global.js";
import { getClient } from "../../notion/client.js";
import { getHistory } from "../../notion/query.js";
import { docLabel, versionStr, header, blank, warn } from "../../utils/output.js";
import chalk from "chalk";
import { ensurePlankDataSourceSchema } from "../notion-setup.js";

export function makeLogCommand(): Command {
  return new Command("log")
    .description("Show version history for tracked docs")
    .argument("[file]", "Optional: show history for this file only")
    .option("-n, --limit <n>", "Number of versions to show per doc", "10")
    .action(async (file: string | undefined, opts: { limit: string }) => {
      const globalCfg = readGlobalConfig();
      const rc = readPlanRC();
      const client = getClient(globalCfg);
      const databaseId = resolveDbId(rc, globalCfg.default_database_id);
      const limit = parseInt(opts.limit, 10);

      const targets = file ? [file] : rc.docs.map((d) => d.file);

      if (targets.length === 0) {
        warn("No docs tracked in .planrc.");
        return;
      }

      if (file && !findDoc(rc, file)) {
        warn(`"${file}" is not tracked in .planrc.`);
        return;
      }

      if (!(await ensurePlankDataSourceSchema(client, databaseId))) {
        return;
      }

      for (const target of targets) {
        const doc = findDoc(rc, target);
        const label = doc ? docLabel(doc.file, doc.title) : chalk.bold(target);

        header(label);
        blank();

        const history = await getHistory(client, databaseId, rc.project, target, limit);

        if (history.length === 0) {
          console.log(`  ${chalk.dim("No versions found in Notion.")}`);
          blank();
          continue;
        }

        for (const row of history) {
          const when = row.pushedAt
            ? new Date(row.pushedAt).toLocaleString()
            : "unknown";
          const msg = row.message ? chalk.dim(`  "${row.message}"`) : "";
          console.log(`  ${versionStr(row.version)}   ${chalk.dim(when)}${msg}`);
        }

        blank();
      }
    });
}
