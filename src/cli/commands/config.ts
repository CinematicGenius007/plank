import { Command } from "commander";
import { input, password } from "@inquirer/prompts";
import {
  readGlobalConfig,
  writeGlobalConfig,
  setGlobalConfigKey,
  maskToken,
  globalConfigExists,
} from "../../config/global.js";
import type { GlobalConfig } from "../../config/types.js";
import { header, blank, info, success } from "../../utils/output.js";
import chalk from "chalk";

export function makeConfigCommand(): Command {
  const cmd = new Command("config")
    .description("Manage system-level Plank configuration (~/.plank/config.json)")
    .addCommand(makeConfigSetCommand())
    .addCommand(makeConfigShowCommand());

  // `plank config` with no subcommand → interactive setup
  cmd.action(async () => {
    header("Plank system configuration");
    blank();

    const existing: Partial<GlobalConfig> = globalConfigExists()
      ? readGlobalConfig()
      : {};

    const notion_token = await password({
      message: "Notion API token:",
      mask: "•",
    });

    const default_database_id = await input({
      message: "Default Notion database ID:",
      default: existing.default_database_id,
    });

    writeGlobalConfig({ notion_token, default_database_id });
    blank();
    success(`Saved to ~/.plank/config.json`);
  });

  return cmd;
}

function makeConfigSetCommand(): Command {
  return new Command("set")
    .description("Set a single config value non-interactively")
    .argument("<key>", "Config key: notion_token | default_database_id")
    .argument("<value>", "Value to set")
    .action((key: string, value: string) => {
      const validKeys: Array<keyof GlobalConfig> = ["notion_token", "default_database_id"];
      if (!validKeys.includes(key as keyof GlobalConfig)) {
        console.error(`Unknown key "${key}". Valid keys: ${validKeys.join(", ")}`);
        process.exit(1);
      }
      setGlobalConfigKey(key as keyof GlobalConfig, value);
      success(`${key} updated`);
    });
}

function makeConfigShowCommand(): Command {
  return new Command("show")
    .description("Print current config (token is masked)")
    .action(() => {
      if (!globalConfigExists()) {
        console.log("No config found. Run `plank config` to set one up.");
        return;
      }
      const cfg = readGlobalConfig();
      header("~/.plank/config.json");
      blank();
      console.log(`  notion_token        ${chalk.dim(maskToken(cfg.notion_token))}`);
      console.log(`  default_database_id ${chalk.cyan(cfg.default_database_id)}`);
      blank();
    });
}
