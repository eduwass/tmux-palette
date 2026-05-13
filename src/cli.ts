import { spawnSync } from "node:child_process"
import { runPalette } from "./palette"
import { commands } from "./palettes/commands"
import { findPane } from "./palettes/find-pane"
import { movePane } from "./palettes/move-pane"
import { themes } from "./palettes/themes"
import { resolveActiveTheme } from "./theme"
import type { Item, PaletteDef } from "./types"
import { userCommands, userHidden, userPalette, userSizing } from "./userConfig"

function substituteTemplate(action: Item["action"], value: string): Item["action"] {
  if ("shell" in action) return { shell: action.shell.replace(/\{\}/g, value) }
  if ("tmux" in action) return { tmux: action.tmux.replace(/\{\}/g, value) }
  if ("popup" in action) return { ...action, popup: action.popup.replace(/\{\}/g, value) }
  return action
}

function linesToItems(
  lines: string[],
  template: Item["action"],
  defaultIcon?: string,
  defaultIconColor?: string,
): Item[] {
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      // <icon>\t<color>\t<title>  (3 fields)
      // <icon>\t<title>           (2 fields)
      // <title>                   (1 field)
      const parts = line.split("\t")
      let icon = defaultIcon
      let iconColor = defaultIconColor
      let title: string
      if (parts.length === 1) {
        title = parts[0]!
      } else if (parts.length === 2) {
        icon = parts[0]!
        title = parts[1]!
      } else {
        icon = parts[0]!
        iconColor = parts[1]!
        title = parts.slice(2).join("\t")
      }
      return {
        icon: icon || undefined,
        iconColor: iconColor || undefined,
        title,
        action: substituteTemplate(template, title),
      }
    })
}

function runPluginCommand(
  command: string,
  template?: Item["action"],
  icon?: string,
  iconColor?: string,
): Item[] {
  const r = spawnSync("sh", ["-c", command], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
  })
  if (r.status !== 0) {
    const err = (r.stderr?.toString().trim() || `exit ${r.status ?? "?"}`).split("\n")[0]
    return [{
      icon: "",
      title: "Plugin command failed",
      description: err,
      action: { shell: ":" },
    }]
  }
  const out = r.stdout?.toString().trim() || ""
  // JSON-array-of-objects mode (full Item control).
  try {
    const parsed = JSON.parse(out)
    if (Array.isArray(parsed) && parsed.every((x) => x && typeof x === "object")) {
      return parsed as Item[]
    }
  } catch {
    // fall through to plain-text mode
  }
  // Plain-text mode: one item per line, action is the palette's template.
  if (template) return linesToItems(out.split("\n"), template, icon, iconColor)
  return [{
    icon: "",
    title: "Plain-text plugin output but no 'action' template set",
    description: "Add an 'action' field to the palette JSON (use {} for the line text)",
    action: { shell: ":" },
  }]
}

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
  themes,
}

async function buildCustomPalette(name: string): Promise<PaletteDef | null> {
  const custom = userPalette(name)
  if (!custom) return null
  const baseCommands: Item[] =
    typeof commands.items === "function" ? await commands.items() : commands.items
  const allMain: Item[] = [...baseCommands, ...userCommands()]
  const referenced: Item[] = (custom.from ?? [])
    .map((title) => allMain.find((i) => i.title === title))
    .filter((i): i is Item => Boolean(i))
  const byCategory: Item[] = custom.fromCategory
    ? allMain.filter((i) => i.category === custom.fromCategory)
    : []
  const pluginItems: Item[] = custom.command
    ? runPluginCommand(custom.command, custom.action, custom.icon, custom.iconColor)
    : []
  return {
    title: custom.title ?? name,
    grouped: custom.grouped ?? false,
    emptyText: custom.emptyText,
    items: [...referenced, ...byCategory, ...pluginItems, ...(custom.items ?? [])],
  }
}

async function applyCommandsOverrides(def: PaletteDef): Promise<PaletteDef> {
  const extras = userCommands()
  const hidden = userHidden()
  const baseItems: Item[] = typeof def.items === "function" ? await def.items() : def.items
  const merged = [...baseItems, ...extras].filter((i) => !hidden.has(i.title))
  if (merged.length === baseItems.length && !extras.length) return def
  return { ...def, items: merged }
}

// Resolves a palette by name: built-in registry → ~/.config/tmux-palette/palettes/<name>.json.
// Called for both top-level CLI invocations and nested in-process navigation.
async function loadPalette(name: string): Promise<PaletteDef | null> {
  const def = palettes[name] ?? (await buildCustomPalette(name))
  if (!def) return null
  if (name === "commands") return applyCommandsOverrides(def)
  return def
}

const args = process.argv.slice(2)
const name = args.find((a) => !a.startsWith("--")) || "commands"
const loaded = await loadPalette(name)

if (!loaded) {
  const builtIn = Object.keys(palettes).join(", ")
  console.error(`Unknown palette: ${name}. Built-in: ${builtIn}. Custom palettes go in ~/.config/tmux-palette/palettes/<name>.json`)
  process.exit(1)
}

let def: PaletteDef = loaded!

// --category=<name> filters items to a single category and retitles
// the popup to it. Useful for binding "open Tools palette" to one key.
const categoryArg = args.find((a) => a.startsWith("--category="))
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
if (args.includes("--measure")) {
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
  const cwArg = args.find((a) => a.startsWith("--cw="))
  const chArg = args.find((a) => a.startsWith("--ch="))
  const cw = cwArg ? Number(cwArg.slice(5)) : 0
  const ch = chArg ? Number(chArg.slice(5)) : 0

  // Derive tmux body/border styles from the resolved theme so the
  // popup background and border match the palette instead of using
  // tmux's defaults (which read as plain white on a dark popup).
  // Border bg=default uses the terminal background so rounded corners
  // blend into the surrounding terminal instead of leaking either the
  // panel color outward or the terminal black inward.
  const theme = resolveActiveTheme(def.theme)
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

await runPalette(def, loadPalette, name)
