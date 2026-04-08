import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { GlobalConfig } from "./types.js";

const CONFIG_DIR = path.join(os.homedir(), ".plank");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function globalConfigPath(): string {
  return CONFIG_FILE;
}

export function globalConfigExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

export function readGlobalConfig(): GlobalConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(
      "Plank is not configured yet. Run `plank config` to set your Notion token and database ID."
    );
  }
  const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
  return JSON.parse(raw) as GlobalConfig;
}

export function writeGlobalConfig(config: GlobalConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function setGlobalConfigKey<K extends keyof GlobalConfig>(
  key: K,
  value: GlobalConfig[K]
): void {
  const existing: Partial<GlobalConfig> = fs.existsSync(CONFIG_FILE)
    ? (JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")) as Partial<GlobalConfig>)
    : {};
  const updated = { ...existing, [key]: value } as GlobalConfig;
  writeGlobalConfig(updated);
}

export function maskToken(token: string): string {
  if (token.length <= 8) return "••••••••";
  return token.slice(0, 7) + "••••••••••••••";
}
