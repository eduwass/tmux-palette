import { spawnSync } from "node:child_process"
import { definePalette } from "../palette"
import type { Item } from "../types"

function tmux(args: string[]): string {
  const r = spawnSync("tmux", args, { stdio: ["ignore", "pipe", "pipe"] })
  return r.stdout?.toString().trimEnd() ?? ""
}

export const movePane = definePalette({
  title: "Move Pane to...",
  grouped: false,
  emptyText: "No targets",
  items: () => {
    const paneId = tmux(["display-message", "-p", "#{pane_id}"])
    const currentWindow = tmux(["display-message", "-p", "#{session_name}:#{window_index}"])

    const sessions = tmux(["list-sessions", "-F", "#S"]).split("\n").filter(Boolean)
    const items: Item[] = []

    for (const session of sessions) {
      items.push({
        icon: "󰝰",
        title: "New window",
        description: `in ${session}`,
        action: { tmux: `break-pane -d -s '${paneId}' -t '${session}:'` },
      })
    }

    const winLines = tmux([
      "list-windows", "-a",
      "-F", "#{session_name}\t#{window_index}\t#{window_name}",
    ]).split("\n").filter(Boolean)

    for (const line of winLines) {
      const [session, windowIndex, windowName] = line.split("\t")
      if (!session || !windowIndex) continue
      if (`${session}:${windowIndex}` === currentWindow) continue

      const name = windowName || `window${windowIndex}`
      const target = `${session}:${windowIndex}`
      items.push({
        icon: "󰖲",
        title: name,
        description: `${session} · ${windowIndex}`,
        action: { tmux: `join-pane -d -s '${paneId}' -t '${target}'` },
      })
    }

    return items
  },
})
