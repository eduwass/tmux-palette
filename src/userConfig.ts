import { readFileSync } from "node:fs"
import type { Item, Theme } from "./types"

const CONFIG_DIR =
  `${process.env.XDG_CONFIG_HOME ?? `${process.env.HOME ?? ""}/.config`}/tmux-palette`

function loadJSON<T>(name: string, fallback: T): T {
  try {
    const raw = readFileSync(`${CONFIG_DIR}/${name}`, "utf8")
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

let _shortcuts: Record<string, string> | null = null
export function userShortcuts(): Record<string, string> {
  if (!_shortcuts) _shortcuts = loadJSON<Record<string, string>>("shortcuts.json", {})
  return _shortcuts
}

let _aliases: Record<string, string[]> | null = null
export function userAliases(): Record<string, string[]> {
  if (!_aliases) _aliases = loadJSON<Record<string, string[]>>("aliases.json", {})
  return _aliases
}

let _theme: Partial<Theme> | null | undefined = undefined
export function userTheme(): Partial<Theme> | null {
  if (_theme === undefined) _theme = loadJSON<Partial<Theme> | null>("theme.json", null)
  return _theme
}

let _commands: Item[] | null = null
export function userCommands(): Item[] {
  if (!_commands) _commands = loadJSON<Item[]>("commands.json", [])
  return _commands
}

export type Sizing = {
  width?: number
  maxHeight?: number
  padX?: number
  // Below this client width the popup goes fullscreen (edge-to-edge,
  // tighter padding). Defaults to 80 — set to 0 to disable.
  mobileWidth?: number
}
let _sizing: Sizing | null = null
export function userSizing(): Sizing {
  if (!_sizing) _sizing = loadJSON<Sizing>("sizing.json", {})
  return _sizing
}
