import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { input } from "@inquirer/prompts";
import { readPlanRC, addDoc, findDoc } from "../../config/planrc.js";
import { header, blank, success, warn } from "../../utils/output.js";

export function makeTrackCommand(): Command {
  return new Command("track")
    .description("Add a file to .planrc tracking (prompts for title, does not push)")
    .argument("<file>", "File path relative to project root")
    .action(async (file: string) => {
      const rc = readPlanRC();

      if (findDoc(rc, file)) {
        warn(`"${file}" is already tracked.`);
        return;
      }

      const localPath = path.join(process.cwd(), file);
      if (!fs.existsSync(localPath)) {
        warn(`"${file}" does not exist locally. Tracking it anyway.`);
      }

      header(`Track new file`);
      blank();
      console.log(`  file: ${file}`);
      blank();

      const title = await input({
        message: "Title for this doc (shown in Notion):",
        validate: (v) => (v.trim().length > 0 ? true : "Required"),
      });

      addDoc(rc, { file, title: title.trim() });
      blank();
      success(`"${file}" added to .planrc as "${title.trim()}"`);
      blank();
    });
}

/** Shared helper: prompt for title and add to rc. Used by push when file is untracked. */
export async function promptAndTrack(
  rc: ReturnType<typeof readPlanRC>,
  file: string
): Promise<ReturnType<typeof readPlanRC>> {
  console.log(`\n  "${file}" is not tracked yet.`);
  const title = await input({
    message: "  Enter a title for this doc (shown in Notion):",
    validate: (v) => (v.trim().length > 0 ? true : "Required"),
  });
  return addDoc(rc, { file, title: title.trim() });
}
