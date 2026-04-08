#!/usr/bin/env node
import { program } from "commander";
import { makeConfigCommand } from "./commands/config.js";
import { makeInitCommand } from "./commands/init.js";
import { makeCloneCommand } from "./commands/clone.js";
import { makeTrackCommand } from "./commands/track.js";
import { makePushCommand } from "./commands/push.js";
import { makePullCommand } from "./commands/pull.js";
import { makeStatusCommand } from "./commands/status.js";
import { makeLogCommand } from "./commands/log.js";

program
  .name("plank")
  .description("Sync local plan docs to Notion with versioning — CLI + MCP server")
  .version("0.1.0");

program.addCommand(makeConfigCommand());
program.addCommand(makeInitCommand());
program.addCommand(makeCloneCommand());
program.addCommand(makeTrackCommand());
program.addCommand(makePushCommand());
program.addCommand(makePullCommand());
program.addCommand(makeStatusCommand());
program.addCommand(makeLogCommand());

// MCP server mode
program
  .command("serve")
  .description("Start the MCP server over stdio (for Claude Code / Codex integration)")
  .action(async () => {
    const { startMcpServer } = await import("../mcp/server.js");
    await startMcpServer();
  });

program.parse();
