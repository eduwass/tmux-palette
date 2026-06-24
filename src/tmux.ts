import { spawnSync } from "node:child_process";

export function tmux(args: string[]): string {
  const r = spawnSync("tmux", args, { stdio: ["ignore", "pipe", "pipe"] });
  return r.stdout?.toString().trimEnd() ?? "";
}

export function tmuxQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
