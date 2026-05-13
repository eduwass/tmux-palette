import { spawnSync } from "node:child_process"
import { definePalette } from "../palette"
import { multiFuzzyScore } from "../fuzzy"
import type { Colors, Item, RenderItemCtx } from "../types"

function tmux(args: string[]): string {
  const r = spawnSync("tmux", args, { stdio: ["ignore", "pipe", "pipe"] })
  return r.stdout?.toString().trimEnd() ?? ""
}

function detectAgent(command: string, title: string): string {
  const direct = new Set(["claude", "codex", "aider", "cursor-agent", "opencode", "gemini", "ollama"])
  if (direct.has(command)) return command
  if (title.startsWith("OC | ") || title.startsWith("OC|")) return "opencode"
  if (/^\s*[*✳⠂⠐⠁⠉⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s/.test(title)) return "claude"
  return ""
}

type Pane = {
  session: string
  windowIndex: string
  paneIndex: string
  windowName: string
  paneTitle: string
  command: string
  path: string
  agent: string
  paneActive: boolean
  windowActive: boolean
  isCurrent: boolean
  target: string
}

type ItemData =
  | { kind: "session"; session: string; count: number; path: string; isCurrent: boolean }
  | { kind: "window"; session: string; windowIndex: string; windowName: string; treePrefix: string }
  | { kind: "pane"; pane: Pane; treePrefix: string }

const PANE_FORMAT = [
  "#{session_name}",
  "#{window_index}",
  "#{pane_index}",
  "#{window_name}",
  "#{pane_title}",
  "#{pane_current_command}",
  "#{pane_current_path}",
  "#{pane_active}",
  "#{window_active}",
].join("\t")

function parsePaneLine(line: string, currentPane: string): Pane | null {
  const [session, windowIndex, paneIndex, windowName, paneTitle, command, path, paneActive, windowActive] =
    line.split("\t")
  if (!session || !windowIndex || !paneIndex) return null
  const target = `${session}:${windowIndex}.${paneIndex}`
  const title = paneTitle || `pane${paneIndex}`
  const cmd = command || ""
  return {
    session,
    windowIndex,
    paneIndex,
    windowName: windowName || `window${windowIndex}`,
    paneTitle: title,
    command: cmd,
    path: path || "",
    agent: detectAgent(cmd, title),
    paneActive: paneActive === "1",
    windowActive: windowActive === "1",
    isCurrent: target === currentPane,
    target,
  }
}

function fetchPanes(): { panes: Pane[]; currentPane: string; currentSession: string } {
  const currentPane = tmux(["display-message", "-p", "#{session_name}:#{window_index}.#{pane_index}"])
  const currentSession = currentPane.split(":")[0] ?? ""

  const lines = tmux(["list-panes", "-a", "-F", PANE_FORMAT]).split("\n").filter(Boolean)
  const panes: Pane[] = []
  for (const line of lines) {
    const p = parsePaneLine(line, currentPane)
    if (p) panes.push(p)
  }
  return { panes, currentPane, currentSession }
}

type WindowGroup = { windowName: string; panes: Pane[] }

function groupPanes(panes: Pane[]): { sessionOrder: string[]; bySession: Map<string, Map<string, WindowGroup>> } {
  const sessionOrder: string[] = []
  const bySession = new Map<string, Map<string, WindowGroup>>()
  for (const p of panes) {
    if (!bySession.has(p.session)) {
      bySession.set(p.session, new Map())
      sessionOrder.push(p.session)
    }
    const ws = bySession.get(p.session)!
    if (!ws.has(p.windowIndex)) ws.set(p.windowIndex, { windowName: p.windowName, panes: [] })
    ws.get(p.windowIndex)!.panes.push(p)
  }
  return { sessionOrder, bySession }
}

function sessionItem(session: string, allInSession: Pane[], currentSession: string): Item {
  const focused = allInSession.find((p) => p.paneActive && p.windowActive) || allInSession[0]
  return {
    title: session,
    action: { tmux: `switch-client -t '${session}'` },
    selectable: false,
    data: {
      kind: "session",
      session,
      count: allInSession.length,
      path: focused?.path ?? "",
      isCurrent: session === currentSession,
    } satisfies ItemData,
  }
}

function paneSelectAction(p: Pane): { tmux: string } {
  return {
    tmux: `select-pane -t '${p.target}' \\; select-window -t '${p.session}:${p.windowIndex}' \\; switch-client -t '${p.session}'`,
  }
}

function paneItem(p: Pane, treePrefix: string): Item {
  return {
    title: p.paneTitle,
    action: paneSelectAction(p),
    data: { kind: "pane", pane: p, treePrefix } satisfies ItemData,
  }
}

function windowItem(session: string, windowIndex: string, w: WindowGroup, treePrefix: string): Item {
  return {
    title: w.windowName,
    action: { tmux: `select-window -t '${session}:${windowIndex}' \\; switch-client -t '${session}'` },
    selectable: false,
    data: {
      kind: "window",
      session,
      windowIndex,
      windowName: w.windowName,
      treePrefix,
    } satisfies ItemData,
  }
}

function windowSubtree(session: string, windowIndex: string, w: WindowGroup, isLastWin: boolean): Item[] {
  const winPrefix = `  ${isLastWin ? "└─" : "├─"} `
  if (w.panes.length === 1) return [paneItem(w.panes[0]!, winPrefix)]

  const items: Item[] = [windowItem(session, windowIndex, w, winPrefix)]
  const panePrefixBase = isLastWin ? "      " : "  │   "
  w.panes.forEach((p, pi) => {
    const isLastPane = pi === w.panes.length - 1
    items.push(paneItem(p, panePrefixBase + (isLastPane ? "└─ " : "├─ ")))
  })
  return items
}

function buildItems(): Item[] {
  const { panes, currentSession } = fetchPanes()
  const { sessionOrder, bySession } = groupPanes(panes)

  const items: Item[] = []
  for (const session of sessionOrder) {
    const windows = [...bySession.get(session)!.entries()]
    const allInSession = windows.flatMap(([, w]) => w.panes)
    items.push(sessionItem(session, allInSession, currentSession))
    windows.forEach(([windowIndex, w], wi) => {
      items.push(...windowSubtree(session, windowIndex, w, wi === windows.length - 1))
    })
  }
  return items
}

function shortenPath(path: string): string {
  const home = process.env.HOME || ""
  return home && path.startsWith(home) ? `~${path.slice(home.length)}` : path
}

function renderSession(data: Extract<ItemData, { kind: "session" }>, colors: Colors, rowBg: string): string {
  const marker = data.isCurrent ? `${colors.accent}▶ ${colors.reset}${rowBg}` : "  "
  const name = `${colors.accent}${colors.bold}${data.session}${colors.reset}${rowBg}`
  const count = `${colors.muted} (${data.count})${colors.reset}${rowBg}`
  const path = data.path ? `  ${colors.muted}${shortenPath(data.path)}${colors.reset}${rowBg}` : ""
  return `${marker}${name}${count}${path}`
}

function renderWindow(
  data: Extract<ItemData, { kind: "window" }>,
  colors: Colors,
  rowBg: string,
  active: boolean,
): string {
  const titleStyle = active ? colors.bold + colors.fg : colors.fg
  return `${colors.muted}${data.treePrefix}${colors.reset}${rowBg}${titleStyle}${data.windowName}${colors.reset}${rowBg}`
}

function paneMarker(p: Pane, colors: Colors): { color: string; char: string } {
  if (p.isCurrent) return { color: colors.accent, char: "▶" }
  if (p.paneActive) return { color: "\x1b[38;2;166;227;161m", char: "●" }
  return { color: colors.muted, char: "○" }
}

function renderPane(
  data: Extract<ItemData, { kind: "pane" }>,
  colors: Colors,
  rowBg: string,
  active: boolean,
  width: number,
): string {
  const p = data.pane
  const { color: markerColor, char: markerChar } = paneMarker(p, colors)
  const titleStyle = p.isCurrent ? colors.muted : active ? colors.bold + colors.fg : colors.fg

  let left = `${colors.muted}${data.treePrefix}${colors.reset}${rowBg}${markerColor}${markerChar}${colors.reset}${rowBg} ${titleStyle}${p.paneTitle}${colors.reset}${rowBg}`
  let leftPlainW = data.treePrefix.length + 1 + 1 + p.paneTitle.length

  if (p.agent) {
    left += `  ${colors.muted}${p.agent}${colors.reset}${rowBg}`
    leftPlainW += 2 + p.agent.length
  }

  const rightText = `${p.windowIndex}.${p.paneIndex}`
  const right = `${colors.muted}${rightText}${colors.reset}${rowBg}`
  const gap = Math.max(1, width - leftPlainW - rightText.length)
  return `${left}${" ".repeat(gap)}${right}`
}

function renderItem(item: Item, ctx: RenderItemCtx): string {
  const { colors, active, width } = ctx
  const data = item.data as ItemData
  const rowBg = active ? colors.selected : colors.panel

  if (data.kind === "session") return renderSession(data, colors, rowBg)
  if (data.kind === "window") return renderWindow(data, colors, rowBg, active)
  return renderPane(data, colors, rowBg, active, width)
}

function filterTree(items: Item[], query: string): Item[] {
  const parts = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!parts.length) return items

  const okSessions = new Set<string>()
  const okWindows = new Set<string>()
  const okPanes = new Set<string>()

  for (const item of items) {
    const data = item.data as ItemData
    if (data.kind !== "pane") continue
    const p = data.pane
    const haystack = [
      p.session, p.windowName, p.paneTitle, p.command, p.path, p.target, p.agent,
    ].filter(Boolean).join(" ")
    if (multiFuzzyScore(haystack, parts) > 0) {
      okPanes.add(p.target)
      okSessions.add(p.session)
      okWindows.add(`${p.session}:${p.windowIndex}`)
    }
  }

  return items.filter((item) => {
    const data = item.data as ItemData
    if (data.kind === "session") return okSessions.has(data.session)
    if (data.kind === "window") return okWindows.has(`${data.session}:${data.windowIndex}`)
    return okPanes.has(data.pane.target)
  })
}

export const findPane = definePalette({
  title: "Find Pane",
  grouped: false,
  emptyText: "No panes",
  items: buildItems,
  renderItem,
  filter: filterTree,
})
