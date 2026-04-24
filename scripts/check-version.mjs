import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, "package.json");
const manPagePath = path.join(repoRoot, "man", "plank.1");

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version;
const manPage = fs.readFileSync(manPagePath, "utf8");

const errors = [];

if (!version || typeof version !== "string") {
  errors.push("package.json is missing a valid version string.");
}

if (!manPage.includes(`"plank ${version}"`)) {
  errors.push(`man/plank.1 does not reference package version ${version}.`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`version check failed: ${error}`);
  }
  process.exit(1);
}

console.log(`version check passed for ${version}`);
