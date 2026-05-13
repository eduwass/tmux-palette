import { charWidth, displayWidth, truncate } from "./text"
import type { Colors, Item } from "./types"

export type Row =
  | { kind: "category"; category: string }
  | { kind: "item"; item: Item; itemIndex: number }

export type RowAction = { y: number; itemIndex: number }

export function isSelectable(item: Item | undefined): boolean {
  return !!item && item.selectable !== false
}

export function step(vis: Item[], from: number, dir: 1 | -1): number {
  if (!vis.length) return 0
  let i = from
  for (let n = 0; n < vis.length; n++) {
    i = (i + dir + vis.length) % vis.length
    if (isSelectable(vis[i])) return i
  }
  return from
}

export function firstSelectable(vis: Item[]): number {
  for (let i = 0; i < vis.length; i++) if (isSelectable(vis[i])) return i
  return -1
}

export function buildRows(vis: Item[], grouped: boolean, filtered: boolean): Row[] {
  const rows: Row[] = []
  let lastCat = ""
  vis.forEach((item, i) => {
    if (grouped && !filtered && item.category && item.category !== lastCat) {
      rows.push({ kind: "category", category: item.category })
      lastCat = item.category
    }
    rows.push({ kind: "item", item, itemIndex: i })
  })
  return rows
}

export function renderCategory(category: string, colors: Colors, rowBg: string): string {
  return `${colors.accent}${colors.bold}${category}${colors.reset}${rowBg}`
}

function aliasChip(item: Item, colors: Colors, rowBg: string): { styled: string; width: number } {
  if (!item.aliases?.length) return { styled: "", width: 0 }
  const alias = item.aliases[0]!
  return {
    styled: `  ${colors.bg} ${alias} ${colors.reset}${rowBg}`,
    width: 2 + 1 + alias.length + 1,
  }
}

function descriptionFragment(item: Item, colors: Colors, rowBg: string): { styled: string; width: number } {
  if (!item.description) return { styled: "", width: 0 }
  return {
    styled: `${colors.muted} - ${item.description}${colors.reset}${rowBg}`,
    width: 3 + item.description.length,
  }
}

function shortcutFragment(item: Item, colors: Colors, active: boolean, rowBg: string): { styled: string; text: string } {
  const text = item.shortcut ?? ""
  if (!text) return { styled: "", text }
  const color = active ? colors.accent : colors.muted
  return { styled: `${color}${text}${colors.reset}${rowBg}`, text }
}

export function renderDefaultItem(item: Item, colors: Colors, active: boolean, bodyWidth: number): string {
  const rowBg = active ? colors.selected : colors.panel
  const marker = active ? `${colors.accent}▌${colors.reset}${rowBg}` : " "
  const iconGlyph = item.icon || " "
  const icon = item.icon ? `${colors.accent}${item.icon}${colors.reset}${rowBg}` : " "
  const titleStyle = active ? colors.bold + colors.fg : colors.muted
  const titleStyled = `${titleStyle}${item.title}${colors.reset}${rowBg}`

  const chip = aliasChip(item, colors, rowBg)
  const desc = descriptionFragment(item, colors, rowBg)
  const sc = shortcutFragment(item, colors, active, rowBg)

  const leftStyled = `${marker} ${icon}  ${titleStyled}${chip.styled}${desc.styled}`
  const leftPlainW =
    1 + 1 + charWidth(iconGlyph) + 2 + displayWidth(item.title) + chip.width + desc.width

  const gap = Math.max(1, bodyWidth - leftPlainW - sc.text.length)
  return leftStyled + " ".repeat(gap) + sc.styled
}

export type HeaderResult = { line: string; escX1: number; escX2: number }

export function composeHeader(
  title: string,
  width: number,
  padX: number,
  bodyWidth: number,
  colors: Colors,
): HeaderResult {
  const headerR = "esc"
  const headerRW = displayWidth(headerR)
  const headerGap = Math.max(0, bodyWidth - displayWidth(title) - headerRW)
  const line = `${colors.panel}${" ".repeat(padX)}${colors.bold}${colors.fg}${title}${colors.reset}${colors.panel}${" ".repeat(headerGap)}${colors.muted}${headerR}${colors.panel}${" ".repeat(padX)}${colors.reset}`
  return {
    line,
    escX1: Math.max(1, width - padX - headerRW),
    escX2: width - padX + 1,
  }
}

export function composeSearch(
  filter: string,
  padX: number,
  bodyWidth: number,
  colors: Colors,
): string {
  const searchValue = filter || "Search"
  const searchColor = filter ? colors.fg : colors.muted
  return `${colors.panel}${" ".repeat(padX)}${colors.accent}▌${searchColor} ${truncate(searchValue, bodyWidth - 2)}${colors.panel}${" ".repeat(padX)}${colors.reset}`
}

function renderListRow(
  row: Row,
  isSelected: boolean,
  bodyWidth: number,
  padX: number,
  colors: Colors,
  renderRow: (row: Row, isSelected: boolean) => string,
): string {
  const rowBg = isSelected ? colors.selected : colors.panel
  const content = renderRow(row, isSelected)
  return `${rowBg}${" ".repeat(padX)}${truncate(content, bodyWidth)}${" ".repeat(padX)}${colors.reset}`
}

export function composeListBody(
  rows: Row[],
  scroll: number,
  listHeight: number,
  selected: number,
  bodyWidth: number,
  padX: number,
  colors: Colors,
  startY: number,
  renderRow: (row: Row, isSelected: boolean) => string,
): { lines: string[]; rowActions: RowAction[] } {
  const lines: string[] = []
  const rowActions: RowAction[] = []

  const end = Math.min(rows.length, scroll + listHeight)
  for (let i = scroll; i < end; i++) {
    const row = rows[i]!
    const isSelected = row.kind === "item" && row.itemIndex === selected
    if (row.kind === "item") rowActions.push({ y: startY + (i - scroll), itemIndex: row.itemIndex })
    lines.push(renderListRow(row, isSelected, bodyWidth, padX, colors, renderRow))
  }
  const blank = `${colors.panel}${" ".repeat(bodyWidth + padX * 2)}${colors.reset}`
  while (lines.length < listHeight) lines.push(blank)
  return { lines, rowActions }
}

export function composeFooter(
  footerText: string,
  padX: number,
  bodyWidth: number,
  colors: Colors,
): string {
  return `${colors.panel}${" ".repeat(padX)}${colors.muted}${truncate(footerText, bodyWidth)}${colors.panel}${" ".repeat(padX)}${colors.reset}`
}
