import { Command } from "commander";
import { readPlanRC, resolveDbId, findDoc } from "../../config/planrc.js";
import { readGlobalConfig } from "../../config/global.js";
import { getClient } from "../../notion/client.js";
import { pullDoc } from "../../notion/pull.js";
import { docLabel, versionStr, written, skipped, error, header, blank, warn } from "../../utils/output.js";
import chalk from "chalk";
import { ensurePlankDataSourceSchema } from "../notion-setup.js";

export function makePullCommand(): Command {
  return new Command("pull")
    .description("Pull latest doc versions from Notion to local files")
    .argument("[file]", "Optional: pull only this file")
    .action(async (file: string | undefined) => {
      const globalCfg = readGlobalConfig();
      const rc = readPlanRC();
      const client = getClient(globalCfg);
      const databaseId = resolveDbId(rc, globalCfg.default_database_id);

      const targets = file
        ? [file]
        : rc.docs.map((d) => d.file);

      if (targets.length === 0) {
        warn("No docs tracked in .planrc.");
        return;
      }

      if (file && !findDoc(rc, file)) {
        warn(`"${file}" is not tracked in .planrc. Add it with \`plank track ${file}\`.`);
        return;
      }

      if (!(await ensurePlankDataSourceSchema(client, databaseId))) {
        return;
      }

      header(`Pulling from Notion  ${chalk.dim(`[${rc.project}]`)}`);
      blank();

      for (const target of targets) {
        const doc = findDoc(rc, target);
        const label = doc
          ? docLabel(doc.file, doc.title)
          : chalk.bold(target);

        try {
          const result = await pullDoc(client, {
            project: rc.project,
            file: target,
            databaseId,
          });

          if (result.outcome === "not_found") {
            warn(`${label}   not found in Notion`);
          } else if (result.outcome === "unchanged") {
            skipped(`${label}   ${versionStr(result.row!.version)}   ${chalk.dim("up to date")}`);
          } else {
            written(`${label}   ${versionStr(result.row!.version)}   ${chalk.blue("→ written")}`);
          }
        } catch (err) {
          error(`${label}   ${String(err)}`);
        }
      }

      blank();
    });
}
