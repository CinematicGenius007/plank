import { Command } from "commander";
import { input, confirm } from "@inquirer/prompts";
import { planrcExists, writePlanRC } from "../../config/planrc.js";
import { readGlobalConfig } from "../../config/global.js";
import type { PlanRC } from "../../config/types.js";
import { header, blank, success, warn } from "../../utils/output.js";

export function makeInitCommand(): Command {
  return new Command("init")
    .description("Create a .planrc file for a new project")
    .action(async () => {
      if (planrcExists()) {
        warn(".planrc already exists in this directory.");
        const overwrite = await confirm({ message: "Overwrite it?", default: false });
        if (!overwrite) {
          console.log("Aborted.");
          return;
        }
      }

      header("Initialising new Plank project");
      blank();

      const project = await input({
        message: "Project code name (used as the key in Notion):",
        validate: (v) => (v.trim().length > 0 ? true : "Required"),
      });

      const description = await input({
        message: "Short description (optional):",
      });

      // Database ID: use global default or let them override
      let defaultDbId = "";
      try {
        const global = readGlobalConfig();
        defaultDbId = global.default_database_id;
      } catch {
        // global config not yet set — fine, they can set it per-project
      }

      const database_id = await input({
        message: "Notion database ID (leave blank to use global default):",
        default: defaultDbId || undefined,
      });

      const rc: PlanRC = {
        project: project.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        docs: [],
        ...(database_id && database_id !== defaultDbId
          ? { notion: { database_id } }
          : {}),
        auto_push: false,
      };

      writePlanRC(rc);
      blank();
      success(`.planrc created for project "${rc.project}"`);
      blank();
      console.log('  Add files with `plank track <file>` or push directly with `plank push <file>`.');
      blank();
    });
}
