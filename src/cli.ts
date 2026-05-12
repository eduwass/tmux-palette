import { runPalette } from "./palette"
import { commands } from "./palettes/commands"
import { findPane } from "./palettes/find-pane"
import { movePane } from "./palettes/move-pane"
import type { Item, PaletteDef } from "./types"
import { userCommands } from "./userConfig"

const palettes: Record<string, PaletteDef> = {
  commands,
  "find-pane": findPane,
  "move-pane": movePane,
}

const name = process.argv[2] || "commands"
let def = palettes[name]

if (!def) {
  console.error(`Unknown palette: ${name}. Available: ${Object.keys(palettes).join(", ")}`)
  process.exit(1)
}

// Append user-defined items to the commands palette (~/.config/tmux-palette/commands.json).
if (name === "commands") {
  const extras = userCommands()
  if (extras.length) {
    const baseItems: Item[] = typeof def.items === "function" ? await def.items() : def.items
    def = { ...def, items: [...baseItems, ...extras] }
  }
}

// Measure mode: print desired popup rows to stdout. Bash wrapper uses
// this to size the popup so the height fits the palette's content
// (capped at the client height). Width stays Raycast-style fixed.
if (process.argv.includes("--measure")) {
  const items: Item[] = typeof def.items === "function" ? await def.items() : def.items
  const cats = new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c))).size
  // chrome: top pad (1) + header (1) + search (1) + spacer (1) + footer spacer (1) + footer (1) + bottom pad (1) = 7
  const rows = items.length + cats + 7
  console.log(rows)
  process.exit(0)
}

await runPalette(def)
