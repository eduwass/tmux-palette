import { spawnSync } from "node:child_process"
import { BoxRenderable, TextRenderable, TextAttributes } from "@opentui/core"
import { definePalette } from "../palette"
import type { Item, RenderItemCtx } from "../types"

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

function fetchPanes(): { panes: Pane[]; currentPane: string; currentSession: string } {
  const currentPane = tmux(["display-message", "-p", "#{session_name}:#{window_index}.#{pane_index}"])
  const currentSession = currentPane.split(":")[0] ?? ""

  const lines = tmux([
    "list-panes", "-a",
    "-F", [
      "#{session_name}",
      "#{window_index}",
      "#{pane_index}",
      "#{window_name}",
      "#{pane_title}",
      "#{pane_current_command}",
      "#{pane_current_path}",
      "#{pane_active}",
      "#{window_active}",
    ].join("\t"),
  ]).split("\n").filter(Boolean)

  const panes: Pane[] = []
  for (const line of lines) {
    const [session, windowIndex, paneIndex, windowName, paneTitle, command, path, paneActive, windowActive] = line.split("\t")
    if (!session || !windowIndex || !paneIndex) continue
    const target = `${session}:${windowIndex}.${paneIndex}`
    const title = paneTitle || `pane${paneIndex}`
    panes.push({
      session,
      windowIndex,
      paneIndex,
      windowName: windowName || `window${windowIndex}`,
      paneTitle: title,
      command: command || "",
      path: path || "",
      agent: detectAgent(command || "", title),
      paneActive: paneActive === "1",
      windowActive: windowActive === "1",
      isCurrent: target === currentPane,
      target,
    })
  }
  return { panes, currentPane, currentSession }
}

// Build the flat ordered list of items (sessions → windows → panes) with
// tree-drawing prefixes pre-computed for each row.
function buildItems(): Item[] {
  const { panes, currentSession } = fetchPanes()

  // Group panes by session → window
  const sessionOrder: string[] = []
  const bySession = new Map<string, Map<string, { windowName: string; panes: Pane[] }>>()
  for (const p of panes) {
    if (!bySession.has(p.session)) {
      bySession.set(p.session, new Map())
      sessionOrder.push(p.session)
    }
    const ws = bySession.get(p.session)!
    if (!ws.has(p.windowIndex)) ws.set(p.windowIndex, { windowName: p.windowName, panes: [] })
    ws.get(p.windowIndex)!.panes.push(p)
  }

  const items: Item[] = []
  for (const session of sessionOrder) {
    const windows = [...bySession.get(session)!.entries()]
    const allInSession = windows.flatMap(([, w]) => w.panes)
    const focused = allInSession.find((p) => p.paneActive && p.windowActive) || allInSession[0]
    items.push({
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
    })

    for (let wi = 0; wi < windows.length; wi++) {
      const entry = windows[wi]!
      const [windowIndex, w] = entry
      const isLastWin = wi === windows.length - 1
      const winPrefix = `  ${isLastWin ? "└─" : "├─"} `

      if (w.panes.length === 1) {
        // Condensed: single-pane window collapses into its pane row.
        const p = w.panes[0]!
        items.push({
          title: p.paneTitle,
          action: {
            tmux: `select-pane -t '${p.target}' \\; select-window -t '${p.session}:${p.windowIndex}' \\; switch-client -t '${p.session}'`,
          },
          data: { kind: "pane", pane: p, treePrefix: winPrefix } satisfies ItemData,
        })
        continue
      }

      // Multi-pane window: emit window header + each pane
      items.push({
        title: w.windowName,
        action: { tmux: `select-window -t '${session}:${windowIndex}' \\; switch-client -t '${session}'` },
        selectable: false,
        data: {
          kind: "window",
          session,
          windowIndex,
          windowName: w.windowName,
          treePrefix: winPrefix,
        } satisfies ItemData,
      })

      const panePrefixBase = isLastWin ? "      " : "  │   "
      for (let pi = 0; pi < w.panes.length; pi++) {
        const p = w.panes[pi]!
        const isLastPane = pi === w.panes.length - 1
        items.push({
          title: p.paneTitle,
          action: {
            tmux: `select-pane -t '${p.target}' \\; select-window -t '${p.session}:${p.windowIndex}' \\; switch-client -t '${p.session}'`,
          },
          data: {
            kind: "pane",
            pane: p,
            treePrefix: panePrefixBase + (isLastPane ? "└─ " : "├─ "),
          } satisfies ItemData,
        })
      }
    }
  }

  return items
}

function shortenPath(path: string): string {
  const home = process.env.HOME || ""
  return home && path.startsWith(home) ? `~${path.slice(home.length)}` : path
}

function renderItem(item: Item, ctx: RenderItemCtx) {
  const { theme, active, id, renderer } = ctx
  const data = item.data as ItemData
  const bg = active ? theme.selected : theme.panel

  const row = new BoxRenderable(renderer, {
    id,
    width: "100%",
    height: 1,
    flexDirection: "row",
    backgroundColor: bg,
  })

  if (data.kind === "session") {
    const marker = data.isCurrent ? "▶ " : "  "
    row.add(new TextRenderable(renderer, {
      id: `${id}-m`, content: marker, fg: theme.accent,
    }))
    row.add(new TextRenderable(renderer, {
      id: `${id}-n`,
      content: data.session,
      fg: theme.accent,
      attributes: TextAttributes.BOLD,
    }))
    row.add(new TextRenderable(renderer, {
      id: `${id}-c`,
      content: ` (${data.count})`,
      fg: theme.muted,
    }))
    if (data.path) {
      row.add(new TextRenderable(renderer, {
        id: `${id}-p`,
        content: `  ${shortenPath(data.path)}`,
        fg: theme.muted,
      }))
    }
    return row
  }

  if (data.kind === "window") {
    row.add(new TextRenderable(renderer, {
      id: `${id}-t`, content: data.treePrefix, fg: theme.muted,
    }))
    row.add(new TextRenderable(renderer, {
      id: `${id}-n`,
      content: data.windowName,
      fg: theme.fg,
      attributes: active ? TextAttributes.BOLD : 0,
    }))
    return row
  }

  // pane
  const p = data.pane
  const markerChar = p.isCurrent ? "▶" : p.paneActive ? "●" : "○"
  const markerColor = p.isCurrent ? theme.accent : p.paneActive ? "#a6e3a1" : theme.muted

  row.add(new TextRenderable(renderer, {
    id: `${id}-t`, content: data.treePrefix, fg: theme.muted,
  }))
  row.add(new TextRenderable(renderer, {
    id: `${id}-m`, content: markerChar, fg: markerColor,
  }))
  row.add(new TextRenderable(renderer, {
    id: `${id}-n`,
    content: ` ${p.paneTitle}`,
    fg: p.isCurrent ? theme.muted : theme.fg,
    attributes: active ? TextAttributes.BOLD : 0,
  }))
  if (p.agent) {
    row.add(new TextRenderable(renderer, {
      id: `${id}-a`, content: `  ${p.agent}`, fg: theme.muted,
    }))
  }
  // Spacer + right-aligned window.pane index
  row.add(new BoxRenderable(renderer, {
    id: `${id}-sp`, flexGrow: 1, height: 1,
  }))
  row.add(new TextRenderable(renderer, {
    id: `${id}-i`,
    content: `${p.windowIndex}.${p.paneIndex} `,
    fg: theme.muted,
  }))
  return row
}

// Filter that preserves parent context: when a pane matches, keep its
// session and window header rows so the tree still makes sense.
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
    ].filter(Boolean).join(" ").toLowerCase()
    if (parts.every((part) => haystack.includes(part))) {
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

