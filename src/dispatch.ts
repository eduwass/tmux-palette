import { writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { popupFlags } from "./hosts/tmux"
import { resolveActiveTheme } from "./theme"
import type { Action } from "./types"

// Encodes an Action into the line the bash wrapper reads after the popup
// closes. Prefixes:
//   host:<cmd>   -> wrapper runs the active host command
//   shell:<cmd>  -> wrapper runs the shell command directly
//   tmux:<cmd>   -> legacy alias accepted by the tmux wrapper
// `palette` is sugar for "open another palette via run-shell -b".
// `run` executes inline (no dispatch needed).
function encodeAction(action: Action): string | null {
  if ("host" in action) return `host:${action.host}`
  if ("tmux" in action) return `tmux:${action.tmux}`
  if ("shell" in action) return `shell:${action.shell}`
  if ("popup" in action)
    return `host:display-popup -E ${popupFlags(resolveActiveTheme(undefined))} -h 80% -w 80% ${action.popup}`
  if ("palette" in action) {
    const bin = process.env.PALETTE_BIN ?? process.env.TMUX_PALETTE_BIN ?? "tmux-palette"
    return `host:run-shell -b '${bin} ${action.palette}'`
  }
  return null
}

export function dispatchToFile(action: Action, cmdFile: string | undefined): void {
  const encoded = encodeAction(action)
  if (encoded && cmdFile) writeFileSync(cmdFile, encoded)
}

export function dispatchDirect(action: Action): number {
  if ("shell" in action) return runShell(action.shell)
  if ("popup" in action) return runShell(action.popup)
  if ("host" in action) return runTmux(action.host)
  if ("tmux" in action) return runTmux(action.tmux)
  return 0
}

function runShell(command: string): number {
  const result = spawnSync("sh", ["-c", command], { stdio: "inherit" })
  return result.status ?? 1
}

function runTmux(command: string): number {
  if (process.env.PALETTE_HOST === "herdr" || process.env.PALETTE_HOST === "zellij") return runShell(command)
  if (!process.env.TMUX) {
    console.error("palette: host action requires tmux; use a shell action or run inside tmux")
    return 1
  }
  return runShell(`tmux ${command}`)
}
