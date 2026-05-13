import { runPalette } from "./palette"
import { commands } from "./palettes/commands"
import { findPane } from "./palettes/find-pane"
import { movePane } from "./palettes/move-pane"
import type { Item, PaletteDef } from "./types"
import { userCommands, userSizing } from "./userConfig"

const DEFAULT_WIDTH = 90
const DEFAULT_MAX_HEIGHT = 24
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

// Measure mode: print "<rows>\t<width>\t<padX>" so the bash wrapper
// can size the popup. Defaults are applied here so sizing.json
// overrides flow through naturally. `--cw=N --ch=N` lets us trigger
// fullscreen mobile mode based on actual client dimensions.
if (process.argv.includes("--measure")) {
  const items: Item[] = typeof def.items === "function" ? await def.items() : def.items
  const cats = new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c))).size
  // chrome: top pad (1) + header (1) + search (1) + spacer (1) + footer spacer (1) + footer (1) + bottom pad (1) = 7
  const sizing = userSizing()
  const maxHeight = sizing.maxHeight ?? DEFAULT_MAX_HEIGHT
  const width = sizing.width ?? DEFAULT_WIDTH
  const padX = sizing.padX ?? DEFAULT_PAD_X
  const mobileWidth = sizing.mobileWidth ?? DEFAULT_MOBILE_WIDTH
  const cwArg = process.argv.find((a) => a.startsWith("--cw="))
  const chArg = process.argv.find((a) => a.startsWith("--ch="))
  const cw = cwArg ? Number(cwArg.slice(5)) : 0
  const ch = chArg ? Number(chArg.slice(5)) : 0

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

  console.log(`${rows}\t${finalWidth}\t${finalPadX}`)
  process.exit(0)
}

await runPalette(def)
