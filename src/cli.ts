import { runPalette } from "./palette"
import { commands } from "./palettes/commands"
import { findPane } from "./palettes/find-pane"
import { movePane } from "./palettes/move-pane"
import { resolveTheme } from "./theme"
import type { Item, PaletteDef } from "./types"
import { userCommands, userHidden, userPalette, userSizing, userTheme } from "./userConfig"

const DEFAULT_WIDTH = 90
const DEFAULT_MAX_HEIGHT = 28
const DEFAULT_PAD_X = 3
// When the client is narrower than this, the popup goes edge-to-edge.
// 80 is the classic terminal width; anything below has too little room
// for a padded popup to feel good. Set to 0 in sizing.json to disable.
const DEFAULT_MOBILE_WIDTH = 80

const palettes: Record<string, PaletteDef> = {
  commands,
  "find-pane": findPane,
  "move-pane": movePane,
}

const name = process.argv[2] || "commands"
let def = palettes[name]

// Custom palettes live in ~/.config/tmux-palette/palettes/<name>.json.
// Looked up here so users can override built-in names too (advanced).
if (!def) {
  const custom = userPalette(name)
  if (custom) {
    const baseCommands: Item[] =
      typeof commands.items === "function" ? await commands.items() : commands.items
    const allMain: Item[] = [...baseCommands, ...userCommands()]
    const referenced: Item[] = (custom.from ?? [])
      .map((title) => allMain.find((i) => i.title === title))
      .filter((i): i is Item => Boolean(i))
    const byCategory: Item[] = custom.fromCategory
      ? allMain.filter((i) => i.category === custom.fromCategory)
      : []
    const items = [...referenced, ...byCategory, ...(custom.items ?? [])]
    def = {
      title: custom.title ?? name,
      grouped: custom.grouped ?? false,
      emptyText: custom.emptyText,
      items,
    }
  }
}

if (!def) {
  const builtIn = Object.keys(palettes).join(", ")
  console.error(`Unknown palette: ${name}. Built-in: ${builtIn}. Custom palettes go in ~/.config/tmux-palette/palettes/<name>.json`)
  process.exit(1)
}

// Append user-defined items to the commands palette and drop any items
// listed in hidden.json (~/.config/tmux-palette/{commands,hidden}.json).
if (name === "commands") {
  const extras = userCommands()
  const hidden = userHidden()
  const baseItems: Item[] = typeof def.items === "function" ? await def.items() : def.items
  const merged = [...baseItems, ...extras].filter((i) => !hidden.has(i.title))
  if (merged.length !== baseItems.length || extras.length) {
    def = { ...def, items: merged }
  }
}

// --category=<name> filters items to a single category and retitles
// the popup to it. Useful for binding "open Tools palette" to one key.
const categoryArg = process.argv.find((a) => a.startsWith("--category="))
const categoryFilter = categoryArg ? categoryArg.slice("--category=".length) : ""
if (categoryFilter) {
  const baseItems: Item[] = typeof def.items === "function" ? await def.items() : def.items
  const filtered = baseItems.filter((i) => i.category === categoryFilter)
  def = { ...def, items: filtered, title: categoryFilter, grouped: false }
}

// Measure mode: print "<rows>\t<width>\t<padX>" so the bash wrapper
// can size the popup. Defaults are applied here so sizing.json
// overrides flow through naturally. `--cw=N --ch=N` lets us trigger
// fullscreen mobile mode based on actual client dimensions.
if (process.argv.includes("--measure")) {
  const items: Item[] = typeof def.items === "function" ? await def.items() : def.items
  const grouped = def.grouped !== false
  const cats = grouped
    ? new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c))).size
    : 0
  // chrome: top pad (1) + header (1) + search (1) + spacer (1) + footer spacer (1) + footer (1) + bottom pad (1) = 7
  const sizing = userSizing()
  const maxHeight = sizing.maxHeight ?? DEFAULT_MAX_HEIGHT
  const width = sizing.width ?? DEFAULT_WIDTH
  const padX = sizing.padX ?? DEFAULT_PAD_X
  const mobileWidth = sizing.mobileWidth ?? DEFAULT_MOBILE_WIDTH
  const border = sizing.border ?? "none"
  const cwArg = process.argv.find((a) => a.startsWith("--cw="))
  const chArg = process.argv.find((a) => a.startsWith("--ch="))
  const cw = cwArg ? Number(cwArg.slice(5)) : 0
  const ch = chArg ? Number(chArg.slice(5)) : 0

  // Derive tmux body/border styles from the resolved theme so the
  // popup background and border match the palette instead of using
  // tmux's defaults (which read as plain white on a dark popup).
  // Border bg=default uses the terminal background so rounded corners
  // blend into the surrounding terminal instead of leaking either the
  // panel color outward or the terminal black inward.
  const baseTheme = resolveTheme(def.theme)
  const theme = { ...baseTheme, ...(userTheme() ?? {}) }
  const bodyStyle = sizing.bodyStyle ?? `bg=${theme.panel}`
  const borderStyle = sizing.borderStyle ?? `fg=${theme.accent},bg=default`

  const desired = items.length + cats + 7
  let rows = Math.min(desired, maxHeight)
  let finalWidth = width
  let finalPadX = padX

  if (mobileWidth > 0 && cw > 0 && cw < mobileWidth) {
    // Mobile/fullscreen: edge-to-edge, tighter padding.
    rows = Math.max(rows, ch)
    finalWidth = cw
    finalPadX = 1
  }

  console.log(`${rows}\t${finalWidth}\t${finalPadX}\t${border}\t${bodyStyle}\t${borderStyle}`)
  process.exit(0)
}

await runPalette(def)
