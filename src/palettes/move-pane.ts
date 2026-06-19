import { definePalette } from "../palette"
import type { HostWindowTarget, PaletteHost } from "../hosts/types"
import type { Item } from "../types"

function newWindowItems(host: PaletteHost, sessions: string[], paneId: string): Item[] {
  return sessions.map((session) => ({
    icon: "󰝰",
    title: "New window",
    description: `in ${session}`,
    action: host.movePaneToNewWindow?.(paneId, session) ?? { shell: ":" },
  }))
}

function joinWindowItems(host: PaletteHost, windows: HostWindowTarget[], paneId: string, currentWindow: string): Item[] {
  const items: Item[] = []
  for (const w of windows) {
    const target = `${w.session}:${w.windowIndex}`
    if (target === currentWindow) continue
    items.push({
      icon: "󰖲",
      title: w.windowName,
      description: `${w.session} · ${w.windowIndex}`,
      action: host.movePaneToWindow?.(paneId, w) ?? { shell: ":" },
    })
  }
  return items
}

export function createMovePane(host: PaletteHost) {
  return definePalette({
    title: "Move Pane to...",
    grouped: false,
    emptyText: "No targets",
    items: () => {
      const state = host.movePaneState?.()
      if (!state) return []
      return [
        ...newWindowItems(host, state.sessions, state.paneId),
        ...joinWindowItems(host, state.windows, state.paneId, state.currentWindow),
      ]
    },
  })
}
