import { spawnSync } from "node:child_process"
import type { HostMovePaneState, HostPane, HostWindowTarget, PaletteHost } from "./types"

type HerdrPane = {
  pane_id: string
  tab_id: string
  workspace_id: string
  label?: string
  osc_title?: string
  agent?: string
  agent_status?: string
  cwd?: string
  foreground_cwd?: string
  focused?: boolean
}

type HerdrTab = {
  tab_id: string
  workspace_id: string
  label?: string
  number?: number
  focused?: boolean
}

type HerdrWorkspace = {
  workspace_id: string
  label?: string
  number?: number
  focused?: boolean
}

function herdr(args: string[]): unknown {
  const r = spawnSync("herdr", args, { stdio: ["ignore", "pipe", "pipe"] })
  const out = r.stdout?.toString().trim()
  if (!out) return null
  try {
    return JSON.parse(out)
  } catch {
    return null
  }
}

function sh(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function panes(): HerdrPane[] {
  const parsed = herdr(["pane", "list"]) as { result?: { panes?: HerdrPane[] } } | null
  return parsed?.result?.panes ?? []
}

function tabs(): HerdrTab[] {
  const parsed = herdr(["tab", "list"]) as { result?: { tabs?: HerdrTab[] } } | null
  return parsed?.result?.tabs ?? []
}

function workspaces(): HerdrWorkspace[] {
  const parsed = herdr(["workspace", "list"]) as { result?: { workspaces?: HerdrWorkspace[] } } | null
  return parsed?.result?.workspaces ?? []
}

function currentPaneId(): string {
  const parsed = herdr(["pane", "current"]) as { result?: { pane?: HerdrPane } } | null
  return parsed?.result?.pane?.pane_id ?? ""
}

function originPaneId(): string {
  return process.env.PALETTE_ORIGIN_PANE_ID || currentPaneId()
}

function paneTitle(pane: HerdrPane): string {
  return pane.label || pane.osc_title || pane.agent || pane.pane_id
}

function paneToHostPane(pane: HerdrPane, tabNames: Map<string, string>, current: string): HostPane {
  return {
    session: pane.workspace_id,
    windowIndex: pane.tab_id,
    paneIndex: pane.pane_id,
    windowName: tabNames.get(pane.tab_id) ?? pane.tab_id,
    paneTitle: paneTitle(pane),
    command: pane.agent ?? pane.agent_status ?? "",
    path: pane.foreground_cwd || pane.cwd || "",
    agent: pane.agent ?? "",
    paneActive: pane.pane_id === current || pane.focused === true,
    windowActive: pane.pane_id === current || pane.focused === true,
    isCurrent: pane.pane_id === current,
    target: pane.pane_id,
  }
}

function firstPaneByTab(allPanes: HerdrPane[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const pane of allPanes) if (!out.has(pane.tab_id)) out.set(pane.tab_id, pane.pane_id)
  return out
}

function movePaneState(): HostMovePaneState {
  const allPanes = panes()
  const allTabs = tabs()
  const paneByTab = firstPaneByTab(allPanes)
  const current = allPanes.find((pane) => pane.pane_id === originPaneId())
  const windows: HostWindowTarget[] = allTabs.map((tab) => ({
    session: tab.workspace_id,
    windowIndex: tab.tab_id,
    windowName: tab.label || tab.tab_id,
    targetPaneId: paneByTab.get(tab.tab_id),
  }))
  return {
    paneId: current?.pane_id ?? originPaneId(),
    currentWindow: `${current?.workspace_id ?? ""}:${current?.tab_id ?? ""}`,
    sessions: workspaces().map((workspace) => workspace.workspace_id),
    windows,
  }
}

export const herdrHost: PaletteHost = {
  id: "herdr",

  listPanes: () => {
    const current = originPaneId()
    const allPanes = panes()
    const tabNames = new Map(tabs().map((tab) => [tab.tab_id, tab.label || tab.tab_id]))
    return {
      panes: allPanes.map((pane) => paneToHostPane(pane, tabNames, current)),
      currentSession: allPanes.find((pane) => pane.pane_id === current)?.workspace_id ?? "",
    }
  },

  focusSession: (workspaceId) => ({ host: `herdr workspace focus ${sh(workspaceId)}` }),

  focusWindow: (workspaceId, tabId) => ({
    host: `herdr workspace focus ${sh(workspaceId)}; herdr tab focus ${sh(tabId)}`,
  }),

  focusPane: (pane) => ({
    host: `herdr workspace focus ${sh(pane.session)}; herdr tab focus ${sh(pane.windowIndex)}; herdr pane current --pane ${sh(pane.target)}`,
  }),

  movePaneState,

  movePaneToNewWindow: (paneId, workspaceId) => ({
    host: `herdr pane move ${sh(paneId)} --new-tab --workspace ${sh(workspaceId)} --focus`,
  }),

  movePaneToWindow: (paneId, target) => ({
    host: target.targetPaneId
      ? `herdr pane move ${sh(paneId)} --tab ${sh(target.windowIndex)} --split right --target-pane ${sh(target.targetPaneId)} --focus`
      : `herdr pane move ${sh(paneId)} --tab ${sh(target.windowIndex)} --split right --focus`,
  }),
}
