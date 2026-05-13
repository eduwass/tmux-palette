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
import { makeColors, resolveTheme } from "./theme"
import type { Item, PaletteDef } from "./types"
import { userAliases, userShortcuts, userTheme } from "./userConfig"

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

export async function runPalette(def: PaletteDef): Promise<void> {
  const baseTheme = resolveTheme(def.theme)
  const theme = { ...baseTheme, ...(userTheme() ?? {}) }
  const colors = makeColors(theme)
  const raw: Item[] = typeof def.items === "function" ? await def.items() : def.items
  const items: Item[] = applyUserOverrides(raw)

  const cmdFile = process.env.TMUX_PALETTE_CMD
  const title = def.title ?? "Commands"
  const grouped = def.grouped !== false
  const emptyText = def.emptyText ?? "No results"

  let filter = ""
  let selected = 0
  let scroll = 0
  let rowActions: RowAction[] = []
  let escAction: { y: number; xStart: number; xEnd: number } | undefined

  const stdin = process.stdin
  const stdout = process.stdout

  if (!stdin.isTTY || !stdout.isTTY || !stdin.setRawMode) {
    console.error("palette requires an interactive terminal")
    process.exit(1)
  }

  function visible(): Item[] {
    const needle = filter.trim()
    if (!needle) return items
    if (def.filter) return def.filter(items, needle)
    return defaultFilter(items, needle)
  }

  stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding("utf8")
  stdout.write("\x1b[?1000h\x1b[?1006h\x1b[?25l")

  function renderRowContent(row: Row, isSelected: boolean, bodyWidth: number): string {
    const rowBg = isSelected ? colors.selected : colors.panel
    if (row.kind === "category") return renderCategory(row.category, colors, rowBg)
    if (def.renderItem) return def.renderItem(row.item, { colors, active: isSelected, width: bodyWidth })
    return renderDefaultItem(row.item, colors, isSelected, bodyWidth)
  }

  function render(): void {
    const width = stdout.columns ?? 80
    const height = stdout.rows ?? 24
    const vis = visible()

    if (!isSelectable(vis[selected])) {
      const f = firstSelectable(vis)
      selected = f >= 0 ? f : 0
    }

    const rows = buildRows(vis, grouped, filter.length > 0)
    // Chrome rows: top pad + header + search + spacer + footer spacer + footer + bottom pad = 7
    const listHeight = Math.max(1, height - 7)
    scroll = clampScroll(rows, listHeight, selected, scroll)

    const padX = 3
    const bodyWidth = width - padX * 2
    const blank = `${colors.panel}${" ".repeat(width)}${colors.reset}`

    const header = composeHeader(title, width, padX, bodyWidth, colors)
    escAction = { y: 2, xStart: header.escX1, xEnd: header.escX2 }

    const body = composeListBody(rows, scroll, listHeight, selected, bodyWidth, padX, colors,
      (row, sel) => renderRowContent(row, sel, bodyWidth))
    rowActions = body.rowActions

    const footerText = buildFooterText(vis.filter(isSelectable).length, emptyText)

    const lines = [
      blank,
      header.line,
      composeSearch(filter, padX, bodyWidth, colors),
      blank,
      ...body.lines,
      blank,
      composeFooter(footerText, padX, bodyWidth, colors),
      blank,
    ]

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

  async function activate(item: Item): Promise<void> {
    cleanup()
    if ("run" in item.action) {
      await item.action.run({ cmdFile })
      process.exit(0)
    }
    dispatchToFile(item.action, cmdFile)
    process.exit(0)
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
    if (escClicked(x, y)) exitNow()
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
    if (key === "\x1b" || key === "\x03") exitNow()
    if (key !== "\r") return false
    const item = vis[selected]
    if (item && isSelectable(item)) void activate(item)
    return true
  }

  function handleEditKey(key: string): boolean {
    if (key === "\x7f") {
      filter = filter.slice(0, -1)
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
