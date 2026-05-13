import { writeFileSync } from "node:fs"
import type { Action } from "./types"

// Encodes an Action into the line the bash wrapper reads after the popup
// closes. Two prefixes:
//   tmux:<cmd>   → wrapper runs `tmux <cmd>`
//   shell:<cmd>  → wrapper runs the shell command directly
// `palette` is sugar for "open another palette via run-shell -b".
// `run` executes inline (no dispatch needed).
export function encodeAction(action: Action): string | null {
  if ("tmux" in action) return `tmux:${action.tmux}`
  if ("shell" in action) return `shell:${action.shell}`
  if ("popup" in action) {
    // Sugar for "open a tmux popup running this command, close on exit".
    // 80% × 80% centered with a border so it stands out from the host pane.
    return `tmux:display-popup -E -h 80% -w 80% ${action.popup}`
  }
  if ("palette" in action) {
    const bin = process.env.TMUX_PALETTE_BIN ?? "tmux-palette"
    return `tmux:run-shell -b '${bin} ${action.palette}'`
  }
  return null
}

export function dispatchToFile(action: Action, cmdFile: string | undefined): void {
  const encoded = encodeAction(action)
  if (encoded && cmdFile) writeFileSync(cmdFile, encoded)
}
