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
  filterCursor: number
  selectionAnchor: number | null
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

function wordBack(str: string, from: number): number {
  let i = from
  while (i > 0 && /\s/.test(str[i - 1]!)) i--
  while (i > 0 && /\S/.test(str[i - 1]!)) i--
  return i
}

function wordForward(str: string, from: number): number {
  let i = from
  while (i < str.length && /\s/.test(str[i]!)) i++
  while (i < str.length && /\S/.test(str[i]!)) i++
  return i
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
  let filterCursor = 0
  // Anchor end of the in-input selection (cursor is the active end). null = no selection.
  let selectionAnchor: number | null = null
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
    stack.push({ def: currentDef, name: currentName, selected, scroll, filter, filterCursor, selectionAnchor })
    await loadDef(next)
    currentName = name
    selected = 0
    scroll = 0
    filter = ""
    filterCursor = 0
    selectionAnchor = null
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
    filterCursor = prev.filterCursor
    selectionAnchor = prev.selectionAnchor
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
  stdout.write("\x1b[?1000h\x1b[?1006h")

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
    const sel = selectionAnchor !== null && selectionAnchor !== filterCursor
      ? { start: Math.min(selectionAnchor, filterCursor), end: Math.max(selectionAnchor, filterCursor) }
      : undefined
    const inner = [
      header.line,
      composeSearch(filter, padX, bodyWidth, colors, sel?.start, sel?.end),
      blank,
      ...body.lines,
      blank,
      composeFooter(footerText, padX, bodyWidth, colors),
    ]
    const lines = bordered ? inner : [blank, ...inner, blank]

    // Position the real terminal cursor on the search row so it blinks
    // where the user is typing. Column math matches composeSearch:
    // padX panel cells + ▌ + space, then filter chars.
    const searchRow = bordered ? 2 : 3
    const cursorCol = Math.min(padX + 3 + filterCursor, padX + 3 + Math.max(0, bodyWidth - 2))

    // Synchronized output + cursor-home (no clear) so the frame swaps
    // atomically without a blank flash, even when arrow keys repeat fast.
    // Cursor is hidden during the redraw and re-shown at its final spot;
    // sync mode makes only the final state visible. OSC 12 tints the
    // terminal cursor to the active theme's accent — re-emitted each
    // frame so the theme switcher's live preview updates it too.
    stdout.write(
      `\x1b[?2026h\x1b[?25l\x1b[H${lines.join("\n")}` +
      `\x1b[${searchRow};${cursorCol}H\x1b[5 q\x1b]12;${theme.accent}\x07\x1b[?25h\x1b[?2026l`,
    )
  }

  function cleanup(): void {
    stdout.write(`${colors.reset}\x1b[?1000l\x1b[?1006l\x1b[?25h\x1b[0 q\x1b]112\x07\x1b[2J\x1b[H`)
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
      // Esc clears the in-input selection before exiting / going back.
      if (selectionAnchor !== null) {
        selectionAnchor = null
        render()
        return true
      }
      escPressed()
      return true
    }
    if (key === "\x03") exitNow()
    if (key !== "\r") return false
    const item = vis[selected]
    if (item && isSelectable(item)) void activate(item)
    return true
  }

  function selRange(): { start: number; end: number } | null {
    if (selectionAnchor === null) return null
    const a = Math.min(selectionAnchor, filterCursor)
    const b = Math.max(selectionAnchor, filterCursor)
    return a === b ? null : { start: a, end: b }
  }

  function deleteSelection(): boolean {
    const r = selRange()
    if (!r) {
      selectionAnchor = null
      return false
    }
    filter = filter.slice(0, r.start) + filter.slice(r.end)
    filterCursor = r.start
    selectionAnchor = null
    return true
  }

  function extendTo(to: number): void {
    const target = Math.max(0, Math.min(to, filter.length))
    if (selectionAnchor === null) selectionAnchor = filterCursor
    filterCursor = target
    if (selectionAnchor === filterCursor) selectionAnchor = null
  }

  function collapseLeft(): void {
    const r = selRange()
    if (r) {
      filterCursor = r.start
      selectionAnchor = null
    } else {
      filterCursor = Math.max(0, filterCursor - 1)
    }
  }

  function collapseRight(): void {
    const r = selRange()
    if (r) {
      filterCursor = r.end
      selectionAnchor = null
    } else {
      filterCursor = Math.min(filter.length, filterCursor + 1)
    }
  }

  function handleEditKey(key: string): boolean {
    // ---- Cursor movement (clears selection on plain moves; extends on shift) ----
    if (key === "\x1b[D") { collapseLeft(); return true }
    if (key === "\x1b[C") { collapseRight(); return true }
    if (key === "\x1b[H" || key === "\x01") { filterCursor = 0; selectionAnchor = null; return true }
    if (key === "\x1b[F" || key === "\x05") { filterCursor = filter.length; selectionAnchor = null; return true }
    // Alt/Ctrl + Left/Right: word-jump. Terminals encode this differently;
    // handle common forms.
    if (key === "\x1bb" || key === "\x1b[1;3D" || key === "\x1b[1;5D" || key === "\x1b\x1b[D") {
      filterCursor = wordBack(filter, filterCursor)
      selectionAnchor = null
      return true
    }
    if (key === "\x1bf" || key === "\x1b[1;3C" || key === "\x1b[1;5C" || key === "\x1b\x1b[C") {
      filterCursor = wordForward(filter, filterCursor)
      selectionAnchor = null
      return true
    }

    // ---- Shift + movement: extend selection ----
    // Modifier numbers: shift=2, shift+alt=4, shift+ctrl=6.
    if (key === "\x1b[1;2D") { extendTo(filterCursor - 1); return true }
    if (key === "\x1b[1;2C") { extendTo(filterCursor + 1); return true }
    if (key === "\x1b[1;2H") { extendTo(0); return true }
    if (key === "\x1b[1;2F") { extendTo(filter.length); return true }
    if (key === "\x1b[1;4D" || key === "\x1b[1;6D") { extendTo(wordBack(filter, filterCursor)); return true }
    if (key === "\x1b[1;4C" || key === "\x1b[1;6C") { extendTo(wordForward(filter, filterCursor)); return true }

    // ---- Edits — change filter, reset list selection + scroll ----
    if (key === "\x7f" || key === "\x08") {
      if (!deleteSelection()) {
        if (filterCursor === 0) return true
        filter = filter.slice(0, filterCursor - 1) + filter.slice(filterCursor)
        filterCursor--
      }
    } else if (key === "\x1b[3~") {
      // Delete: drop char at cursor (or selection if any).
      if (!deleteSelection()) {
        if (filterCursor >= filter.length) return true
        filter = filter.slice(0, filterCursor) + filter.slice(filterCursor + 1)
      }
    } else if (key === "\x1b\x7f" || key === "\x1b\x08" || key === "\x17") {
      // Alt+Backspace / Ctrl+W: delete word before cursor (or selection).
      if (!deleteSelection()) {
        const start = wordBack(filter, filterCursor)
        filter = filter.slice(0, start) + filter.slice(filterCursor)
        filterCursor = start
      }
    } else if (key === "\x15") {
      // Ctrl+U: kill from start to cursor (or selection). At cursor=end with
      // no selection this clears the line — covers Cmd+Backspace remaps.
      if (!deleteSelection()) {
        filter = filter.slice(filterCursor)
        filterCursor = 0
      }
    } else if (key === "\x0b") {
      // Ctrl+K: kill from cursor to end (or selection).
      if (!deleteSelection()) {
        filter = filter.slice(0, filterCursor)
      }
    } else if (key.length === 1 && key >= " ") {
      // Typing replaces selection (if any), then inserts.
      deleteSelection()
      filter = filter.slice(0, filterCursor) + key + filter.slice(filterCursor)
      filterCursor++
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
      stdout.write("\x1b[?1000l\x1b[?1006l\x1b[?25h\x1b[0 q\x1b]112\x07")
      stdin.setRawMode(false)
    } catch {}
  })
  process.on("SIGTERM", () => exitNow())
  process.on("SIGHUP", () => exitNow())
  process.on("SIGWINCH", () => render())

  render()
}
