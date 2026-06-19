import { spawnSync } from "node:child_process"
import type { HostPane, HostWindowTarget, PaletteHost } from "./types"
import type { Theme } from "../types"
import { userSizing } from "../userConfig"

function tmux(args: string[]): string {
  const r = spawnSync("tmux", args, { stdio: ["ignore", "pipe", "pipe"] })
  return r.stdout?.toString().trimEnd() ?? ""
}

function tmuxQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function detectAgent(command: string, title: string): string {
  const direct = new Set(["claude", "codex", "aider", "cursor-agent", "opencode", "gemini", "ollama"])
  if (direct.has(command)) return command
  if (title.startsWith("OC | ") || title.startsWith("OC|")) return "opencode"
  if (/^\s*[*✳⠂⠐⠁⠉⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s/.test(title)) return "claude"
  return ""
}

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

function parsePaneLine(line: string, currentPane: string): HostPane | null {
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

function parseWindowLine(line: string): HostWindowTarget | null {
  const [session, windowIndex, windowName] = line.split("\t")
  if (!session || !windowIndex) return null
  return { session, windowIndex, windowName: windowName || `window${windowIndex}` }
}

const TRANSPARENT = "transparent"

const ANSI_BASE: Record<string, number> = {
  black: 0, red: 1, green: 2, yellow: 3,
  blue: 4, magenta: 5, cyan: 6, white: 7,
}

function namedColor(value: string): { base: string; bright: boolean } | null {
  const bright = value.startsWith("bright-")
  const base = bright ? value.slice(7) : value
  return ANSI_BASE[base] === undefined ? null : { base, bright }
}

/** Translate a theme color into a tmux style value: "transparent" -> "default",
 *  a palette name -> tmux's form ("blue" / "brightblack"), hex passes through. */
export function tmuxColor(value: string): string {
  if (value === TRANSPARENT) return "default"
  const n = namedColor(value)
  if (n) return n.bright ? `bright${n.base}` : n.base
  return value
}

/** tmux display-popup body style (-s). */
export function tmuxBodyStyle(theme: Theme): string {
  return `bg=${tmuxColor(theme.panel)}`
}

/** Builds the tmux display-popup style flags. */
export function popupFlags(theme: Theme, borderOverride?: string): string {
  const sizing = userSizing()
  const popupBorder = borderOverride ?? sizing.popupBorder ?? "none"
  const bodyStyle = sizing.popupBodyStyle ?? tmuxBodyStyle(theme)
  if (popupBorder === "none") return `-B -s '${bodyStyle}'`
  const borderStyle = sizing.popupBorderStyle ?? `fg=${tmuxColor(theme.accent)},bg=default`
  return `-b ${popupBorder} -s '${bodyStyle}' -S '${borderStyle}'`
}

export const tmuxHost: PaletteHost = {
  id: "tmux",

  listPanes: () => {
    const currentPane = tmux(["display-message", "-p", "#{session_name}:#{window_index}.#{pane_index}"])
    const currentSession = currentPane.split(":")[0] ?? ""
    const panes = tmux(["list-panes", "-a", "-F", PANE_FORMAT])
      .split("\n")
      .filter(Boolean)
      .map((line) => parsePaneLine(line, currentPane))
      .filter((pane): pane is HostPane => Boolean(pane))
    return { panes, currentSession }
  },

  focusSession: (session) => ({ host: `switch-client -t ${tmuxQuote(session)}` }),

  focusWindow: (session, windowIndex) => ({
    host: `select-window -t ${tmuxQuote(`${session}:${windowIndex}`)} \\; switch-client -t ${tmuxQuote(session)}`,
  }),

  focusPane: (pane) => {
    const windowTarget = `${pane.session}:${pane.windowIndex}`
    return {
      host: `select-pane -t ${tmuxQuote(pane.target)} \\; select-window -t ${tmuxQuote(windowTarget)} \\; switch-client -t ${tmuxQuote(pane.session)}`,
    }
  },

  movePaneState: () => ({
    paneId: tmux(["display-message", "-p", "#{pane_id}"]),
    currentWindow: tmux(["display-message", "-p", "#{session_name}:#{window_index}"]),
    sessions: tmux(["list-sessions", "-F", "#S"]).split("\n").filter(Boolean),
    windows: tmux([
      "list-windows", "-a",
      "-F", "#{session_name}\t#{window_index}\t#{window_name}",
    ]).split("\n").filter(Boolean).map(parseWindowLine).filter((w): w is HostWindowTarget => Boolean(w)),
  }),

  movePaneToNewWindow: (paneId, session) => ({
    host: `break-pane -d -s ${tmuxQuote(paneId)} -t ${tmuxQuote(`${session}:`)}`,
  }),

  movePaneToWindow: (paneId, target) => ({
    host: `join-pane -d -s ${tmuxQuote(paneId)} -t ${tmuxQuote(`${target.session}:${target.windowIndex}`)}`,
  }),
}
