import { createTwoFilesPatch } from "diff";
import chalk from "chalk";

export function unifiedDiff(
  contentA: string,
  contentB: string,
  labelA: string,
  labelB: string
): string {
  return createTwoFilesPatch(labelA, labelB, contentA, contentB);
}

/** Render a unified diff string with colour for terminal output. */
export function colorDiff(patch: string): string {
  return patch
    .split("\n")
    .map((line) => {
      if (line.startsWith("+++") || line.startsWith("---")) return chalk.bold(line);
      if (line.startsWith("@@")) return chalk.cyan(line);
      if (line.startsWith("+")) return chalk.green(line);
      if (line.startsWith("-")) return chalk.red(line);
      return line;
    })
    .join("\n");
}
