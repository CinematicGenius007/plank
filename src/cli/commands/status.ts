import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { readPlanRC, resolveDbId } from "../../config/planrc.js";
import { readGlobalConfig } from "../../config/global.js";
import { getClient } from "../../notion/client.js";
import { getLatestChecksum } from "../../notion/query.js";
import { sha256 } from "../../utils/checksum.js";
import { docLabel, versionStr, header, blank, warn } from "../../utils/output.js";
import chalk from "chalk";

export function makeStatusCommand(): Command {
  return new Command("status")
    .description("Compare local files against the latest Notion versions")
    .action(async () => {
      const globalCfg = readGlobalConfig();
      const rc = readPlanRC();
      const client = getClient(globalCfg);
      const databaseId = resolveDbId(rc, globalCfg.default_database_id);

      if (rc.docs.length === 0) {
        warn("No docs tracked in .planrc.");
        return;
      }

      header(`Status  ${chalk.dim(`[${rc.project}]`)}`);
      blank();

      for (const doc of rc.docs) {
        const localPath = path.join(process.cwd(), doc.file);
        const label = docLabel(doc.file, doc.title);

        const remoteChecksum = await getLatestChecksum(client, databaseId, rc.project, doc.file);

        if (!fs.existsSync(localPath) && !remoteChecksum) {
          console.log(`  ${chalk.dim("?")}  ${label}   ${chalk.dim("not found locally or remotely")}`);
          continue;
        }

        if (!remoteChecksum) {
          console.log(`  ${chalk.yellow("+")}  ${label}   ${chalk.yellow("local only — not yet pushed")}`);
          continue;
        }

        if (!fs.existsSync(localPath)) {
          console.log(`  ${chalk.blue("↓")}  ${label}   ${chalk.blue("remote only — run pull")}`);
          continue;
        }

        const localContent = fs.readFileSync(localPath, "utf-8");
        const localChecksum = sha256(localContent);

        if (localChecksum === remoteChecksum) {
          console.log(`  ${chalk.green("✓")}  ${label}   ${chalk.dim("up to date")}`);
        } else {
          console.log(`  ${chalk.yellow("M")}  ${label}   ${chalk.yellow("modified — run push")}`);
        }
      }

      blank();
    });
}
