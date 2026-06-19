import { spawnSync } from "node:child_process"
import type { HostPane, PaletteHost } from "./types"

type ZellijPane = {
  id: number
  is_plugin: boolean
  is_focused?: boolean
  is_floating?: boolean
  is_suppressed?: boolean
  title?: string
  terminal_command?: string | null
  plugin_url?: string | null
  is_selectable?: boolean
  tab_id: number
  tab_position: number
  tab_name: string
  pane_command?: string
  pane_cwd?: string
}

function zellijJson(args: string[]): unknown {
  const result = spawnSync("zellij", args, { stdio: ["ignore", "pipe", "ignore"] })
  if (result.status !== 0) return null
  const out = result.stdout.toString().trim()
  try {
    return JSON.parse(out)
  } catch {
    return null
  }
}

function sh(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function panes(): ZellijPane[] {
  const parsed = zellijJson(["action", "list-panes", "--json", "--all"]) as ZellijPane[] | null
  return parsed ?? []
}

function paneTarget(pane: ZellijPane): string {
  return `${pane.is_plugin ? "plugin" : "terminal"}_${pane.id}`
}

function originPaneId(allPanes: ZellijPane[]): string {
  const focused = allPanes.find((pane) => pane.is_focused) ?? allPanes[0]
  return process.env.PALETTE_ORIGIN_PANE_ID || (focused ? paneTarget(focused) : "")
}

function paneTitle(pane: ZellijPane): string {
  return pane.title || pane.terminal_command || pane.plugin_url || paneTarget(pane)
}

function paneToHostPane(pane: ZellijPane, current: string): HostPane {
  const target = paneTarget(pane)
  return {
    session: "zellij",
    windowIndex: String(pane.tab_id),
    paneIndex: target,
    windowName: pane.tab_name || `Tab ${pane.tab_position + 1}`,
    paneTitle: paneTitle(pane),
    command: pane.pane_command || pane.terminal_command || pane.plugin_url || "",
    path: pane.pane_cwd || "",
    agent: "",
    paneActive: target === current || pane.is_focused === true,
    windowActive: target === current || pane.is_focused === true,
    isCurrent: target === current,
    target,
  }
}

export const zellijHost: PaletteHost = {
  id: "zellij",

  listPanes: () => {
    const allPanes = panes().filter((pane) => pane.is_selectable !== false && !pane.is_suppressed)
    const current = originPaneId(allPanes)
    return {
      panes: allPanes.map((pane) => paneToHostPane(pane, current)),
      currentSession: "zellij",
    }
  },

  focusSession: () => ({ shell: ":" }),

  focusWindow: (_session, tabId) => ({ host: `zellij action go-to-tab-by-id ${sh(tabId)}` }),

  focusPane: (pane) => ({
    host: `zellij action go-to-tab-by-id ${sh(pane.windowIndex)}; zellij action focus-pane-id ${sh(pane.target)}`,
  }),
}
