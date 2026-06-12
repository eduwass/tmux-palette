import { readdirSync, readFileSync } from "node:fs"
import { bundledThemeMap, bundledThemes, type BundledTheme } from "./themes-bundled"
import type { Colors, Theme } from "./types"
import { userSizing } from "./userConfig"

const CONFIG_DIR =
  `${process.env.XDG_CONFIG_HOME ?? `${process.env.HOME ?? ""}/.config`}/tmux-palette`

const DEFAULT_SLUG = "shades-of-purple"

function isFullTheme(obj: unknown): obj is Theme {
  if (!obj || typeof obj !== "object") return false
  const keys = ["bg", "panel", "selected", "fg", "muted", "accent"] as const
  return keys.every((k) => typeof (obj as Record<string, unknown>)[k] === "string")
}

let _userThemes: Record<string, Theme> | null = null
function userThemes(): Record<string, Theme> {
  if (_userThemes) return _userThemes
  const out: Record<string, Theme> = {}
  try {
    for (const file of readdirSync(`${CONFIG_DIR}/themes`)) {
      if (!file.endsWith(".json")) continue
      const slug = file.slice(0, -5)
      try {
        const parsed = JSON.parse(readFileSync(`${CONFIG_DIR}/themes/${file}`, "utf8"))
        if (isFullTheme(parsed)) out[slug] = parsed
      } catch {}
    }
  } catch {}
  _userThemes = out
  return out
}

export type ThemeListEntry = { slug: string; name: string; theme: Theme; source: "user" | "bundled" }

/**
 * All themes available to the switcher: bundled + ~/.config/tmux-palette/themes/*.json.
 * User-defined themes override bundled ones if slugs collide.
 */
export function listThemes(): ThemeListEntry[] {
  const user = userThemes()
  const bundled: ThemeListEntry[] = bundledThemes.map((t: BundledTheme) => ({
    slug: t.slug,
    name: t.name,
    theme: t.theme,
    source: "bundled" as const,
  }))
  const userEntries: ThemeListEntry[] = Object.entries(user).map(([slug, theme]) => ({
    slug,
    name: slug,
    theme,
    source: "user" as const,
  }))
  // Filter out bundled entries that have a user override (replace, don't dupe).
  const userSlugs = new Set(userEntries.map((e) => e.slug))
  const filteredBundled = bundled.filter((b) => !userSlugs.has(b.slug))
  return [...userEntries, ...filteredBundled].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Resolve a Theme value from the palette def. Accepts:
 *   - undefined  → default theme
 *   - string     → bundled or user theme slug
 *   - Theme      → full theme literal
 *
 * Throws on unknown slug so typos surface during palette load.
 */
function resolveTheme(theme: Theme | string | undefined): Theme {
  if (!theme) return bundledThemeMap[DEFAULT_SLUG]!
  if (typeof theme === "string") {
    const user = userThemes()[theme]
    if (user) return user
    const bundled = bundledThemeMap[theme]
    if (bundled) return bundled

    throw new Error(`Unknown theme: ${theme}`)
  }
  return theme
}

/**
 * Read ~/.config/tmux-palette/theme.json. Returns either:
 *   - { name: "slug" }                 → look up by slug
 *   - { bg, panel, selected, ... }     → full Theme override
 *   - { bg?, accent?, ... }            → partial override (merged onto resolved theme)
 *   - null if no file / parse failure
 */
type UserThemeFile =
  | { name: string }
  | Partial<Theme>

let _userThemeFile: UserThemeFile | null | undefined = undefined
function userThemeFile(): UserThemeFile | null {
  if (_userThemeFile !== undefined) return _userThemeFile
  try {
    const raw = readFileSync(`${CONFIG_DIR}/theme.json`, "utf8")
    _userThemeFile = JSON.parse(raw) as UserThemeFile
  } catch {
    _userThemeFile = null
  }
  return _userThemeFile
}

/** Drop the cached theme.json contents so the next resolve re-reads disk.
 *  Call this immediately after writing theme.json so an in-process
 *  navigate-back picks up the new active theme. */
export function invalidateThemeCache(): void {
  _userThemeFile = undefined
}

/**
 * Combine the palette's declared theme with the user's ~/.config/tmux-palette/theme.json.
 * Encapsulates the "name vs. override" logic so cli.ts / palette.ts don't have to.
 */
export function resolveActiveTheme(declared: Theme | string | undefined): Theme {
  const file = userThemeFile()
  if (file && "name" in file && typeof (file as { name: unknown }).name === "string") {
    return resolveTheme((file as { name: string }).name)
  }
  return { ...resolveTheme(declared), ...(file ?? {}) }
}

function rgb(hex: string): [number, number, number] {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) throw new Error(`Invalid hex color: ${hex}`)
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)]
}

function fg(hex: string): string {
  const [r, g, b] = rgb(hex)
  return `\x1b[38;2;${r};${g};${b}m`
}

function bg(hex: string): string {
  const [r, g, b] = rgb(hex)
  return `\x1b[48;2;${r};${g};${b}m`
}

/** Sentinel a theme field can take to fall back to the terminal default
 *  (transparent background / default foreground) instead of a hex color. */
const TRANSPARENT = "transparent";

/** The 8 ANSI palette color names → their base index. A "bright-" prefix
 *  selects the bright variant (e.g. "bright-black" is the usual gray). */
const ANSI_BASE: Record<string, number> = {
  black: 0, red: 1, green: 2, yellow: 3,
  blue: 4, magenta: 5, cyan: 6, white: 7,
}

/** Parse a palette color name like "blue" or "bright-black". Returns null for
 *  hex / "transparent" / anything unrecognized so callers can fall through. */
function namedColor(value: string): { base: string; idx: number; bright: boolean } | null {
  const bright = value.startsWith("bright-")
  const base = bright ? value.slice(7) : value
  const idx = ANSI_BASE[base]
  return idx === undefined ? null : { base, idx, bright }
}

/** Background ANSI code. "transparent" → default bg (\x1b[49m); a palette name
 *  → the terminal's own color (\x1b[4Xm / \x1b[10Xm); otherwise a hex truecolor.
 *  Routing through this keeps rgb() from ever seeing a non-hex value. */
function bgOrDefault(value: string): string {
  if (value === TRANSPARENT) return "\x1b[49m"
  const n = namedColor(value)
  if (n) return `\x1b[${(n.bright ? 100 : 40) + n.idx}m`
  return bg(value)
}

/** Foreground ANSI code. "transparent" → default fg (\x1b[39m); a palette name
 *  → the terminal's own color (\x1b[3Xm / \x1b[9Xm); otherwise a hex truecolor. */
function fgOrDefault(value: string): string {
  if (value === TRANSPARENT) return "\x1b[39m"
  const n = namedColor(value)
  if (n) return `\x1b[${(n.bright ? 90 : 30) + n.idx}m`
  return fg(value)
}

/** Translate a theme color into a tmux style value: "transparent" → "default",
 *  a palette name → tmux's form ("blue" / "brightblack"), hex passes through. */
export function tmuxColor(value: string): string {
  if (value === TRANSPARENT) return "default"
  const n = namedColor(value)
  if (n) return n.bright ? `bright${n.base}` : n.base
  return value
}

/** OSC 12 sequence tinting the terminal cursor to the accent, or "" when the
 *  accent is a palette name / transparent — those leave the cursor on the
 *  terminal's own configured cursor color rather than forcing an X11 name. */
export function cursorTint(theme: Theme): string {
  return /^#?[0-9a-f]{6}$/i.test(theme.accent) ? `\x1b]12;${theme.accent}\x07` : ""
}

export function makeColors(theme: Theme): Colors {
  return {
    bg: bgOrDefault(theme.bg),
    panel: bgOrDefault(theme.panel),
    selected: bgOrDefault(theme.selected) + fgOrDefault(theme.fg),
    fg: fgOrDefault(theme.fg),
    muted: fgOrDefault(theme.muted),
    accent: fgOrDefault(theme.accent),
    selectedFg: theme.selectedFg ? fgOrDefault(theme.selectedFg) : "",
    titleFg: theme.titleFg ? fgOrDefault(theme.titleFg) : "",
    reset: "\x1b[0m",
    bold: "\x1b[1m",
  }
}

/** tmux display-popup body style (-s). Resolves the panel through tmuxColor so
 *  transparent → bg=default, a palette name → the terminal's color, hex → hex. */
export function tmuxBodyStyle(theme: Theme): string {
  return `bg=${tmuxColor(theme.panel)}`
}

/** Builds the tmux display-popup style flags: -B + body style (-s) when there
 *  is no border, the -b/-s/-S triplet otherwise. `borderOverride` (a per-action
 *  `border` setting) wins over sizing.popupBorder. */
export function popupFlags(theme: Theme, borderOverride?: string): string {
  const sizing = userSizing()
  const popupBorder = borderOverride ?? sizing.popupBorder ?? "none"
  const bodyStyle = sizing.popupBodyStyle ?? tmuxBodyStyle(theme)
  if (popupBorder === "none") return `-B -s '${bodyStyle}'`
  const borderStyle = sizing.popupBorderStyle ?? `fg=${tmuxColor(theme.accent)},bg=default`
  return `-b ${popupBorder} -s '${bodyStyle}' -S '${borderStyle}'`
}
