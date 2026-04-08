import fs from "node:fs";
import path from "node:path";
import type { DocEntry, PlanRC } from "./types.js";

const PLANRC_FILENAME = ".planrc";

export function planrcPath(cwd: string = process.cwd()): string {
  return path.join(cwd, PLANRC_FILENAME);
}

export function planrcExists(cwd: string = process.cwd()): boolean {
  return fs.existsSync(planrcPath(cwd));
}

export function readPlanRC(cwd: string = process.cwd()): PlanRC {
  const p = planrcPath(cwd);
  if (!fs.existsSync(p)) {
    throw new Error(`No .planrc found in ${cwd}. Run \`plank init\` to create one.`);
  }
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw) as PlanRC;
}

export function writePlanRC(rc: PlanRC, cwd: string = process.cwd()): void {
  fs.writeFileSync(planrcPath(cwd), JSON.stringify(rc, null, 2) + "\n", "utf-8");
}

/** Returns the database ID to use — project-level override takes priority. */
export function resolveDbId(rc: PlanRC, defaultDbId: string): string {
  return rc.notion?.database_id ?? defaultDbId;
}

/** Find a tracked doc by filename. */
export function findDoc(rc: PlanRC, file: string): DocEntry | undefined {
  return rc.docs.find((d) => d.file === file);
}

/** Add a doc entry and persist. Throws if already tracked. */
export function addDoc(rc: PlanRC, entry: DocEntry, cwd: string = process.cwd()): PlanRC {
  if (findDoc(rc, entry.file)) {
    throw new Error(`"${entry.file}" is already tracked in .planrc.`);
  }
  const updated: PlanRC = { ...rc, docs: [...rc.docs, entry] };
  writePlanRC(updated, cwd);
  return updated;
}
