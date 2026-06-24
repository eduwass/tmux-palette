import { readFileSync } from "node:fs"
import type { Item } from "./types"

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

let _commands: Item[] | null = null
export function userCommands(): Item[] {
  if (!_commands) _commands = loadJSON<Item[]>("commands.json", [])
  return _commands
}

let _hidden: Set<string> | null = null
export function userHidden(): Set<string> {
  if (!_hidden) {
    const list = loadJSON<string[]>("hidden.json", [])
    _hidden = new Set(list)
  }
  return _hidden
}

export type Sizing = {
  width?: number
  maxHeight?: number
  padX?: number
  // Below this client width the popup goes fullscreen (edge-to-edge,
  // tighter padding). Defaults to 80 — set to 0 to disable.
  mobileWidth?: number
  // Main palette border: none (default) | single | double | heavy |
  // rounded | padded | simple. Forwarded to tmux display-popup -b.
  border?: string
  // tmux style for the popup body (e.g. "bg=#1a1b26"). Defaults to
  // bg=<theme.panel> so the popup body matches the palette colors.
  bodyStyle?: string
  // tmux style for the popup border (e.g. "fg=#7aa2f7"). Defaults to
  // fg=<theme.accent> so the border matches the palette colors.
  borderStyle?: string
  // Border for { popup } action popups. Defaults to "none".
  popupBorder?: string
  // Styles for { popup } action popups. Default to theme.panel / accent.
  popupBodyStyle?: string
  popupBorderStyle?: string
  // Width/height for { popup } action popups. tmux accepts a number of cells
  // ("80") or a percentage ("80%"). Defaults: 80% × 80%.
  popupWidth?: string
  popupHeight?: string
  // Horizontal/vertical padding (in cells) around { popup } action popups.
  // Effectively shrinks the popup by 2 * padX cells wide / 2 * padY cells
  // tall, giving breathing room from the terminal edges. Defaults: 0 / 0.
  // Per-item override via the action's `padX` / `padY` fields.
  popupPadX?: number
  popupPadY?: number
  // ESC key behavior in nested palettes. "back" pops one level at a time
  // (Raycast-style), closing the popup only at the top. "exit" always
  // closes immediately. Default: "back".
  esc?: "back" | "exit"
}
let _sizing: Sizing | null = null
export function userSizing(): Sizing {
  if (!_sizing) _sizing = loadJSON<Sizing>("sizing.json", {})
  return _sizing
}

export type Navigation = {
  // When true, moving past the first/last selectable item wraps around.
  // Default: true.
  wrapAtListEnds?: boolean
}
let _navigation: Navigation | null = null
export function userNavigation(): Navigation {
  if (!_navigation) _navigation = loadJSON<Navigation>("navigation.json", {})
  return _navigation
}

export type CustomPalette = {
  title?: string
  items?: Item[]
  // Titles to pull from the main commands palette (built-ins + commands.json).
  from?: string[]
  // Pull every item with this category from the main commands palette.
  fromCategory?: string
  // Shell command that prints either:
  //   - a JSON array of Item objects (full control), or
  //   - one item per line (fzf-style; needs an `action` template below).
  command?: string
  // Default action for plain-text command output. `{}` in the action
  // string is replaced with the selected line's content (fzf syntax).
  action?: Item["action"]
  // Default icon for plain-text items. Per-line override: embed
  // `<icon>\t<title>` in the line and the parser splits on tab.
  icon?: string
  // Default icon color (hex, e.g. "#22cc22") for plain-text items.
  // Per-line override: emit `<icon>\t<color>\t<title>` with 3 tab fields.
  iconColor?: string
  grouped?: boolean
  emptyText?: string
}
export function userPalette(name: string): CustomPalette | null {
  return loadJSON<CustomPalette | null>(`palettes/${name}.json`, null)
}
