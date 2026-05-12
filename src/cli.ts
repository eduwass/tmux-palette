import { runPalette } from "./palette"
import { commands } from "./palettes/commands"
import { findPane } from "./palettes/find-pane"
import { movePane } from "./palettes/move-pane"
import type { Item, PaletteDef } from "./types"

const palettes: Record<string, PaletteDef> = {
  commands,
  "find-pane": findPane,
  "move-pane": movePane,
}

const name = process.argv[2] || "commands"
const def = palettes[name]

if (!def) {
  console.error(`Unknown palette: ${name}. Available: ${Object.keys(palettes).join(", ")}`)
  process.exit(1)
}

// Measure mode: print desired popup dimensions ("rows<TAB>cols") for the
// bash wrapper to size the tmux popup. Avoids fullscreen-by-default.
if (process.argv.includes("--measure")) {
  const items: Item[] = typeof def.items === "function" ? await def.items() : def.items
  const cats = new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c))).size
  // chrome: header (1) + search (1) + spacer (1) + footerSpacer (1) + footer (1) + padding (2) = 7
  const rows = items.length + cats + 7

  // Widest row: "▌ <icon>  <title>  [<alias>]  - <description>  ...  <shortcut> "
  const widths = items.map((i) => {
    const icon = i.icon ? 3 : 1 // 2-cell glyph + space; conservative
    const title = i.title.length
    const alias = i.aliases?.length ? 3 + i.aliases[0].length : 0
    const desc = i.description ? 3 + i.description.length : 0
    const sc = i.shortcut ? 4 + i.shortcut.length : 0
    return 4 + icon + title + alias + desc + sc + 2
  })
  const titleLen = (def.title ?? "Commands").length + 8 // "Commands ... esc"
  const cols = Math.max(50, titleLen, ...widths)

  console.log(`${rows}\t${cols}`)
  process.exit(0)
}

await runPalette(def)
