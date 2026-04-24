import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plank-smoke-"));
  const home = path.join(root, "home");
  const cwd = path.join(root, "workspace");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(cwd, { recursive: true });
  return { root, home, cwd };
}

function runPlank(args, sandbox) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: sandbox.cwd,
    env: {
      ...process.env,
      HOME: sandbox.home,
      USERPROFILE: sandbox.home,
    },
    encoding: "utf8",
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    output: `${result.stdout}${result.stderr}`,
  };
}

test("built CLI entrypoint exists", () => {
  assert.equal(fs.existsSync(cliPath), true, `Expected built CLI at ${cliPath}`);
});

test("plank --help prints command overview", () => {
  const sandbox = makeSandbox();
  const result = runPlank(["--help"], sandbox);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: plank/);
  assert.match(result.stdout, /config/);
  assert.match(result.stdout, /serve/);
});

test("plank with no arguments prints help and exits successfully", () => {
  const sandbox = makeSandbox();
  const result = runPlank([], sandbox);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: plank/);
  assert.match(result.stdout, /Commands:/);
});

test("plank --version matches package version", () => {
  const sandbox = makeSandbox();
  const result = runPlank(["--version"], sandbox);

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), packageJson.version);
});

test("config show is friendly when global config does not exist", () => {
  const sandbox = makeSandbox();
  const result = runPlank(["config", "show"], sandbox);

  assert.equal(result.status, 0);
  assert.match(result.output, /No config found/);
});

test("config set writes isolated config and show masks the token", () => {
  const sandbox = makeSandbox();

  const token = "secret_example_token_123456";
  const dbId = "db_123456";

  const setToken = runPlank(["config", "set", "notion_token", token], sandbox);
  assert.equal(setToken.status, 0);

  const setDb = runPlank(["config", "set", "default_database_id", dbId], sandbox);
  assert.equal(setDb.status, 0);

  const configPath = path.join(sandbox.home, ".plank", "config.json");
  assert.equal(fs.existsSync(configPath), true);

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.equal(config.notion_token, token);
  assert.equal(config.default_database_id, dbId);

  const shown = runPlank(["config", "show"], sandbox);
  assert.equal(shown.status, 0);
  assert.match(shown.output, /default_database_id/);
  assert.match(shown.output, /secret_/);
  assert.doesNotMatch(shown.output, /token_123456/);
});
