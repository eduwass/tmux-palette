import { writeFileSync } from "node:fs"
import { dispatchToFile } from "./dispatch"
import { defaultFilter } from "./fuzzy"
import {
  buildRows,
  composeFooter,
  composeHeader,
  composeListBody,
  composeSearch,
  firstSelectable,
  isSelectable,
  renderCategory,
  renderDefaultItem,
  step,
  type Row,
  type RowAction,
} from "./render"
import { makeColors, resolveActiveTheme } from "./theme"
import type { ActionContext, Item, PaletteDef, PopupAction } from "./types"
import { userAliases, userShortcuts, userSizing } from "./userConfig"

export type PaletteLoader = (name: string) => Promise<PaletteDef | null>

type NavState = {
  def: PaletteDef
  name: string
  selected: number
  scroll: number
  filter: string
}

export function definePalette(def: PaletteDef): PaletteDef {
  return def
}

function applyUserOverrides(items: Item[]): Item[] {
  const shortcuts = userShortcuts()
  const aliases = userAliases()
  return items.map((i) => {
    const extra = aliases[i.title]
    return {
      ...i,
      shortcut: i.shortcut ?? shortcuts[i.title],
      aliases: extra ? [...(i.aliases ?? []), ...extra] : i.aliases,
    }
  })
}

function clampScroll(rows: Row[], listHeight: number, selected: number, scroll: number): number {
  const selectedRowIdx = rows.findIndex((r) => r.kind === "item" && r.itemIndex === selected)
  if (selectedRowIdx >= 0) {
    if (selectedRowIdx < scroll) scroll = selectedRowIdx
    if (selectedRowIdx >= scroll + listHeight) scroll = selectedRowIdx - listHeight + 1
  }
  return Math.max(0, Math.min(scroll, Math.max(0, rows.length - listHeight)))
}

function buildFooterText(selectableCount: number, emptyText: string): string {
  if (!selectableCount) return emptyText
  const noun = selectableCount === 1 ? "command" : "commands"
  return `enter select   up/down move   ${selectableCount} ${noun}`
}

const NAV_KEYS: Record<string, number> = {
  "\x1b[A": -1,
  "\x10": -1,
  "\x1b[B": 1,
  "\x0e": 1,
  "\x1b[5~": -10,
  "\x1b[6~": 10,
}

type MouseEvent = { button: number; x: number; y: number; kind: string }

function parseMouseEvent(key: string): MouseEvent | null {
  const m = /^\x1b\[<(?<button>\d+);(?<x>\d+);(?<y>\d+)(?<kind>[mM])/.exec(key)
  if (!m?.groups) return null
  return {
    button: Number(m.groups.button),
    x: Number(m.groups.x),
    y: Number(m.groups.y),
    kind: m.groups.kind!,
  }
}

export async function runPalette(def: PaletteDef, loader?: PaletteLoader, initialName?: string): Promise<void> {
  // These all swap when navigating between palettes, so they're `let`.
  let currentDef = def
  let currentName = initialName ?? "commands"
  let theme = resolveActiveTheme(def.theme)
  let colors = makeColors(theme)
  let rawItems: Item[] = typeof def.items === "function" ? await def.items() : def.items
  let items: Item[] = applyUserOverrides(rawItems)
  let title = def.title ?? "Commands"
  let grouped = def.grouped !== false
  let emptyText = def.emptyText ?? "No results"

  const cmdFile = process.env.TMUX_PALETTE_CMD

  let filter = ""
  let selected = currentDef.initialSelected ? Math.max(0, currentDef.initialSelected(items)) : 0
  let scroll = 0
  let rowActions: RowAction[] = []
  let escAction: { y: number; xStart: number; xEnd: number } | undefined

  // Back-stack for in-process palette navigation (Raycast-style).
  const stack: NavState[] = []

  const stdin = process.stdin
  const stdout = process.stdout

  if (!stdin.isTTY || !stdout.isTTY || !stdin.setRawMode) {
    console.error("palette requires an interactive terminal")
    process.exit(1)
  }

  async function loadDef(d: PaletteDef): Promise<void> {
    currentDef = d
    theme = resolveActiveTheme(d.theme)
    colors = makeColors(theme)
    rawItems = typeof d.items === "function" ? await d.items() : d.items
    items = applyUserOverrides(rawItems)
    title = d.title ?? "Commands"
    grouped = d.grouped !== false
    emptyText = d.emptyText ?? "No results"
  }

  async function navigateTo(name: string): Promise<void> {
    if (!loader) return
    const next = await loader(name)
    if (!next) return
    stack.push({ def: currentDef, name: currentName, selected, scroll, filter })
    await loadDef(next)
    currentName = name
    selected = 0
    scroll = 0
    filter = ""
    render()
  }

  async function navigateBack(): Promise<void> {
    if (stack.length === 0) return exitNow()
    const prev = stack.pop()!
    await loadDef(prev.def)
    currentName = prev.name
    selected = prev.selected
    scroll = prev.scroll
    filter = prev.filter
    render()
  }

  function visible(): Item[] {
    const needle = filter.trim()
    if (!needle) return items
    if (currentDef.filter) return currentDef.filter(items, needle)
    return defaultFilter(items, needle)
  }

  stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding("utf8")
  stdout.write("\x1b[?1000h\x1b[?1006h\x1b[?25l")

  function renderRowContent(row: Row, isSelected: boolean, bodyWidth: number): string {
    const rowBg = isSelected ? colors.selected : colors.panel
    if (row.kind === "category") return renderCategory(row.category, colors, rowBg)
    if (currentDef.renderItem)
      return currentDef.renderItem(row.item, { colors, active: isSelected, width: bodyWidth })
    return renderDefaultItem(row.item, colors, isSelected, bodyWidth)
  }

  function ensureSelectable(vis: Item[]): void {
    if (isSelectable(vis[selected])) return
    const f = firstSelectable(vis)
    selected = f >= 0 ? f : 0
  }

  function render(): void {
    const width = stdout.columns ?? 80
    const height = stdout.rows ?? 24
    const vis = visible()
    ensureSelectable(vis)

    if (currentDef.onSelect) {
      const preview = currentDef.onSelect(vis[selected])
      if (preview) {
        theme = preview
        colors = makeColors(theme)
      }
    }

    const rows = buildRows(vis, grouped, filter.length > 0)
    // When the tmux border is on it visually replaces our top/bottom pad
    // rows, so we skip them (chrome = 5 instead of 7) and shift mouse-y
    // mapping by 1.
    const bordered = process.env.TMUX_PALETTE_BORDERED === "1"
    const chromeRows = bordered ? 5 : 7
    const listHeight = Math.max(1, height - chromeRows)
    scroll = clampScroll(rows, listHeight, selected, scroll)

    const padX = Math.max(0, Number(process.env.TMUX_PALETTE_PADX) || 3)
    const bodyWidth = Math.max(1, width - padX * 2)
    const blank = `${colors.panel}${" ".repeat(width)}${colors.reset}`

    const header = composeHeader(title, width, padX, bodyWidth, colors)
    escAction = { y: bordered ? 1 : 2, xStart: header.escX1, xEnd: header.escX2 }

    const body = composeListBody(rows, scroll, listHeight, selected, bodyWidth, padX, colors, bordered ? 4 : 5,
      (row, sel) => renderRowContent(row, sel, bodyWidth))
    rowActions = body.rowActions

    const footerText = buildFooterText(vis.filter(isSelectable).length, emptyText)
    const inner = [
      header.line,
      composeSearch(filter, padX, bodyWidth, colors),
      blank,
      ...body.lines,
      blank,
      composeFooter(footerText, padX, bodyWidth, colors),
    ]
    const lines = bordered ? inner : [blank, ...inner, blank]

    // Synchronized output + cursor-home (no clear) so the frame swaps
    // atomically without a blank flash, even when arrow keys repeat fast.
    stdout.write("\x1b[?2026h\x1b[?25l\x1b[H" + lines.join("\n") + "\x1b[?2026l")
  }

  function cleanup(): void {
    stdout.write(`${colors.reset}\x1b[?1000l\x1b[?1006l\x1b[?25h\x1b[2J\x1b[H`)
    stdin.setRawMode(false)
    stdin.pause()
  }

  function exitNow(): never {
    cleanup()
    process.exit(0)
  }

  // Builds the tmux display-popup flags for a { popup } action: -B + body
  // style if no border, -b/-s/-S triplet otherwise. Per-action `border`
  // override wins over sizing.popupBorder.
  function buildPopupFlags(borderOverride?: string): string {
    const sizing = userSizing()
    const popupBorder = borderOverride ?? sizing.popupBorder ?? "none"
    const bodyStyle = sizing.popupBodyStyle ?? `bg=${theme.panel}`
    if (popupBorder === "none") return `-B -s '${bodyStyle}'`
    const borderStyle = sizing.popupBorderStyle ?? `fg=${theme.accent},bg=default`
    return `-b ${popupBorder} -s '${bodyStyle}' -S '${borderStyle}'`
  }

  // Builds a shell expression that resolves a "80%" / "80" size spec into
  // an absolute cell count and subtracts 2*pad. Resolved at shell execution
  // time so tmux display-message returns the actual client dimensions
  // (querying from inside the palette popup gives popup-local dims instead).
  function popupDimExpr(spec: string, axis: "client_width" | "client_height", pad: number): string {
    if (spec.endsWith("%")) {
      const pct = Number(spec.slice(0, -1))
      return `$(( $(tmux display-message -p '#{${axis}}') * ${pct} / 100 - ${2 * pad} ))`
    }
    return String(Math.max(1, Number(spec) - 2 * pad))
  }

  // tmux only allows one popup per client so we can't nest or resize mid-run.
  // For { popup } actions we exit the palette, run a sized popup with the
  // command, then re-launch the palette at relaunchName once it closes.
  // Per-action overrides (width/height/padX/padY/border) win over sizing.json.
  function buildPopupRelaunchCommand(action: PopupAction, relaunchName: string): string {
    const sizing = userSizing()
    const padX = action.padX ?? sizing.popupPadX ?? 0
    const padY = action.padY ?? sizing.popupPadY ?? 0
    const width = action.width ?? sizing.popupWidth ?? "80%"
    const height = action.height ?? sizing.popupHeight ?? "80%"
    const wExpr = popupDimExpr(width, "client_width", padX)
    const hExpr = popupDimExpr(height, "client_height", padY)
    const bin = process.env.TMUX_PALETTE_BIN ?? "tmux-palette"
    // The trailing relaunch uses `run-shell -b` so tmux returns immediately;
    // the wrapper script itself opens a new display-popup for the palette.
    return `tmux display-popup -E ${buildPopupFlags(action.border)} -h ${hExpr} -w ${wExpr} ${action.popup}; tmux run-shell -b '${bin} ${relaunchName}'`
  }

  function dispatchPopupAction(action: PopupAction): never {
    cleanup()
    if (cmdFile) {
      try {
        writeFileSync(cmdFile, `shell:${buildPopupRelaunchCommand(action, currentName)}`)
      } catch {}
    }
    process.exit(0)
  }

  async function dispatchDirectAction(item: Item): Promise<never> {
    cleanup()
    if ("run" in item.action) {
      await item.action.run({ cmdFile })
      process.exit(0)
    }
    dispatchToFile(item.action, cmdFile)
    process.exit(0)
  }

  // In-process action that runs inline and then navigates back to the
  // previous palette (or closes if at root). Used by the theme switcher
  // to "apply + return". Doesn't tear down stdin/stdout — we stay live.
  async function dispatchApplyAction(fn: (ctx: ActionContext) => void | Promise<void>): Promise<void> {
    await fn({ cmdFile })
    if (stack.length > 0) await navigateBack()
    else exitNow()
  }

  async function activate(item: Item): Promise<void> {
    if ("palette" in item.action && loader) {
      await navigateTo(item.action.palette)
      return
    }
    if ("apply" in item.action) return dispatchApplyAction(item.action.apply)
    if ("popup" in item.action) dispatchPopupAction(item.action)
    await dispatchDirectAction(item)
  }

  function escPressed(): void {
    const escMode = userSizing().esc ?? "back"
    if (escMode === "back" && stack.length > 0) {
      void navigateBack()
      return
    }
    exitNow()
  }

  function escClicked(x: number, y: number): boolean {
    return !!escAction && y === escAction.y && x >= escAction.xStart && x <= escAction.xEnd
  }

  function handleRowClick(y: number, vis: Item[]): void {
    const hit = rowActions.find((r) => r.y === y)
    if (!hit) return
    const item = vis[hit.itemIndex]
    if (!item || !isSelectable(item)) return
    selected = hit.itemIndex
    void activate(item)
  }

  function handleMouseClick(x: number, y: number, vis: Item[]): void {
    if (escClicked(x, y)) {
      escPressed()
      return
    }
    handleRowClick(y, vis)
  }

  function handleMouse(button: number, x: number, y: number, kind: string, vis: Item[]): void {
    if (button === 64) selected = step(vis, selected, -1)
    else if (button === 65) selected = step(vis, selected, 1)
    else if (button === 0 && kind === "M") handleMouseClick(x, y, vis)
    render()
  }

  function handleNavigationKey(key: string, vis: Item[]): boolean {
    const delta = NAV_KEYS[key]
    if (delta === undefined) return false
    const dir = delta > 0 ? 1 : -1
    const count = Math.abs(delta)
    for (let i = 0; i < count; i++) selected = step(vis, selected, dir)
    return true
  }

  function handleEnterOrExit(key: string, vis: Item[]): boolean {
    if (key === "\x1b") {
      escPressed()
      return true
    }
    if (key === "\x03") exitNow()
    if (key !== "\r") return false
    const item = vis[selected]
    if (item && isSelectable(item)) void activate(item)
    return true
  }

  function handleEditKey(key: string): boolean {
    if (key === "\x7f" || key === "\x08") {
      filter = filter.slice(0, -1)
    } else if (key === "\x1b\x7f" || key === "\x1b\x08" || key === "\x17") {
      // Alt+Backspace / Ctrl+W: drop trailing whitespace, then trailing word.
      filter = filter.replace(/\s+$/, "").replace(/\S+$/, "")
    } else if (key === "\x15" || key === "\x0b") {
      // Ctrl+U / Ctrl+K: clear filter. (Cmd+Backspace arrives as \x15 in
      // many terminals; users can remap via their terminal's keybind config.)
      filter = ""
    } else if (key.length === 1 && key >= " ") {
      filter += key
    } else {
      return false
    }
    selected = 0
    scroll = 0
    return true
  }

  function handleKey(key: string, vis: Item[]): void {
    if (handleEnterOrExit(key, vis)) return
    if (handleNavigationKey(key, vis) || handleEditKey(key)) render()
  }

  stdin.on("data", (key: string) => {
    const vis = visible()
    // SGR mouse: press+release sometimes arrive in one chunk on some terminals,
    // so the regex doesn't anchor to end-of-string.
    const mouse = parseMouseEvent(key)
    if (mouse) {
      handleMouse(mouse.button, mouse.x, mouse.y, mouse.kind, vis)
      return
    }
    handleKey(key, vis)
  })

  process.on("exit", () => {
    try {
      stdout.write("\x1b[?1000l\x1b[?1006l\x1b[?25h")
      stdin.setRawMode(false)
    } catch {}
  })
  process.on("SIGTERM", () => exitNow())
  process.on("SIGHUP", () => exitNow())
  process.on("SIGWINCH", () => render())

  render()
}
