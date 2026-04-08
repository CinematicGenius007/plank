import chalk from "chalk";

/** Format a doc reference consistently: filename + quoted title */
export function docLabel(file: string, title: string): string {
  return `${chalk.bold(file)}  ${chalk.dim(`"${title}"`)}`;
}

/** Format a version number */
export function versionStr(v: number): string {
  return chalk.cyan(`v${v}`);
}

export function success(msg: string): void {
  console.log(`  ${chalk.green("✓")}  ${msg}`);
}

export function skipped(msg: string): void {
  console.log(`  ${chalk.dim("–")}  ${msg}`);
}

export function pushed(msg: string): void {
  console.log(`  ${chalk.green("↑")}  ${msg}`);
}

export function written(msg: string): void {
  console.log(`  ${chalk.blue("↓")}  ${msg}`);
}

export function warn(msg: string): void {
  console.log(`  ${chalk.yellow("!")}  ${msg}`);
}

export function error(msg: string): void {
  console.error(`  ${chalk.red("✗")}  ${msg}`);
}

export function info(msg: string): void {
  console.log(`  ${chalk.dim(msg)}`);
}

export function header(msg: string): void {
  console.log(`\n${chalk.bold(msg)}`);
}

export function blank(): void {
  console.log();
}
