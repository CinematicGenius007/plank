import { Command } from "commander";
import { planrcExists, writePlanRC } from "../../config/planrc.js";
import { readGlobalConfig } from "../../config/global.js";
import { getClient } from "../../notion/client.js";
import { getProjectDocs } from "../../notion/query.js";
import { pullDoc } from "../../notion/pull.js";
import { docLabel, versionStr, written, skipped, header, blank, warn, error } from "../../utils/output.js";
import type { PlanRC } from "../../config/types.js";
import { confirm, input } from "@inquirer/prompts";
import chalk from "chalk";
import { ensurePlankDataSourceSchema } from "../notion-setup.js";

export function makeCloneCommand(): Command {
  return new Command("clone")
    .description("Bootstrap a project on a new machine: create .planrc + pull all docs")
    .argument("<project>", "Project code name (must match the name stored in Notion)")
    .option("--db <database_id>", "Notion database ID (overrides global default)")
    .action(async (project: string, opts: { db?: string }) => {
      const globalCfg = readGlobalConfig();
      const client = getClient(globalCfg);
      const databaseId = opts.db ?? globalCfg.default_database_id;

      if (!databaseId) {
        error("No database ID configured. Run `plank config` first or pass --db <id>.");
        process.exit(1);
      }

      if (planrcExists()) {
        warn(".planrc already exists in this directory.");
        const proceed = await confirm({ message: "Overwrite it?", default: false });
        if (!proceed) {
          console.log("Aborted.");
          return;
        }
      }

      header(`Cloning project "${project}" from Notion`);
      blank();

      if (!(await ensurePlankDataSourceSchema(client, databaseId))) {
        return;
      }

      const docs = await getProjectDocs(client, databaseId, project);

      if (docs.length === 0) {
        console.log(`  No project "${project}" found in Notion.`);
        blank();
        const create = await confirm({
          message: `Create a new project "${project}" instead? (runs \`plank init\`)`,
          default: false,
        });
        if (create) {
          // Delegate to init — dynamic import to avoid circular deps
          const { makeInitCommand } = await import("./init.js");
          const initCmd = makeInitCommand();
          await initCmd.parseAsync([project], { from: "user" });
        }
        return;
      }

      // Write .planrc from discovered docs
      const rc: PlanRC = {
        project,
        docs,
        ...(opts.db ? { notion: { database_id: opts.db } } : {}),
        auto_push: false,
      };
      writePlanRC(rc);

      // Pull latest version of each doc
      for (const doc of docs) {
        const label = docLabel(doc.file, doc.title);
        try {
          const result = await pullDoc(client, {
            project,
            file: doc.file,
            databaseId,
          });

          if (result.outcome === "written") {
            written(`${label}   ${versionStr(result.row!.version)}   ${chalk.blue("→ written")}`);
          } else if (result.outcome === "unchanged") {
            skipped(`${label}   ${versionStr(result.row!.version)}   ${chalk.dim("up to date")}`);
          } else {
            warn(`${label}   not found`);
          }
        } catch (err) {
          error(`${label}   ${String(err)}`);
        }
      }

      blank();
      console.log(`  ${chalk.green(".planrc created.")} You're set up.`);
      blank();
    });
}
