import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { readPlanRC, readPlanRC as reloadPlanRC, resolveDbId, findDoc } from "../../config/planrc.js";
import { readGlobalConfig } from "../../config/global.js";
import { getClient } from "../../notion/client.js";
import { pushDoc } from "../../notion/push.js";
import { promptAndTrack } from "./track.js";
import { docLabel, versionStr, pushed, skipped, error, header, blank, warn } from "../../utils/output.js";
import chalk from "chalk";
import { ensurePlankDataSourceSchema } from "../notion-setup.js";

export function makePushCommand(): Command {
  return new Command("push")
    .description("Push tracked docs to Notion (all or a specific file)")
    .argument("[file]", "Optional: push only this file")
    .option("-m, --message <msg>", "Push message (like a commit message)")
    .action(async (file: string | undefined, opts: { message?: string }) => {
      const globalCfg = readGlobalConfig();
      let rc = readPlanRC();
      const client = getClient(globalCfg);
      const databaseId = resolveDbId(rc, globalCfg.default_database_id);

      let targets: string[];

      if (file) {
        // Single file — track it first if needed
        if (!findDoc(rc, file)) {
          rc = await promptAndTrack(rc, file);
        }
        targets = [file];
      } else {
        if (rc.docs.length === 0) {
          warn("No docs tracked in .planrc. Use `plank track <file>` to add one.");
          return;
        }
        targets = rc.docs.map((d) => d.file);
      }

      if (!(await ensurePlankDataSourceSchema(client, databaseId))) {
        return;
      }

      header(`Pushing to Notion  ${chalk.dim(`[${rc.project}]`)}`);
      blank();

      for (const target of targets) {
        // Re-read rc so title is always current (may have been updated by promptAndTrack)
        rc = reloadPlanRC();
        const doc = findDoc(rc, target);
        if (!doc) continue;

        const localPath = path.join(process.cwd(), target);
        if (!fs.existsSync(localPath)) {
          error(`${docLabel(doc.file, doc.title)}  file not found locally`);
          continue;
        }

        const content = fs.readFileSync(localPath, "utf-8");

        try {
          const result = await pushDoc(client, globalCfg, {
            project: rc.project,
            file: doc.file,
            title: doc.title,
            content,
            databaseId,
            message: opts.message,
          });

          if (result.outcome === "skipped") {
            skipped(
              `${docLabel(doc.file, doc.title)}   ${versionStr(result.version!)}   ${chalk.dim("unchanged, skipped")}`
            );
          } else {
            pushed(
              `${docLabel(doc.file, doc.title)}   ${versionStr(result.version!)}   ${chalk.green("→ pushed")}`
            );
          }
        } catch (err) {
          error(`${docLabel(doc.file, doc.title)}   ${String(err)}`);
        }
      }

      blank();
    });
}
