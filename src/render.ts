import { charWidth, displayWidth, truncate } from "./text"
import type { Colors, Item } from "./types"

function hexToFg(hex: string): string | null {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return null
  return `\x1b[38;2;${parseInt(m[1]!, 16)};${parseInt(m[2]!, 16)};${parseInt(m[3]!, 16)}m`
}

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
  // Pill text MUST set fg explicitly. The preceding title fragment ends
  // with `colors.reset + rowBg` which clears fg back to terminal default
  // — on unselected rows (rowBg = panel, no fg in it) the alias would
  // render in whatever the terminal's default fg is, often invisible
  // against the theme's bg color. colors.fg + colors.bg gives the
  // theme's primary text/background pair, guaranteed-readable.
  return {
    styled: `  ${colors.bg}${colors.fg} ${alias} ${colors.reset}${rowBg}`,
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
  const color = active ? (colors.selectedFg || colors.accent) : colors.muted
  return { styled: `${color}${text}${colors.reset}${rowBg}`, text }
}

export function renderDefaultItem(item: Item, colors: Colors, active: boolean, bodyWidth: number): string {
  const rowBg = active ? colors.selected : colors.panel
  // On the active row, selectedFg (when set) gives icon/marker/title/shortcut a
  // single highlight color. When unset it falls back to today's colors so other
  // themes are unchanged: marker/icon use accent, title uses fg.
  const activeHi = colors.selectedFg || colors.accent
  const marker = active ? `${activeHi}▌${colors.reset}${rowBg}` : " "
  const iconGlyph = item.icon || " "
  const iconColor =
    (item.iconColor && hexToFg(item.iconColor)) || (active ? activeHi : colors.accent)
  const icon = item.icon ? `${iconColor}${item.icon}${colors.reset}${rowBg}` : " "
  const titleStyle = active ? colors.bold + (colors.selectedFg || colors.fg) : colors.muted
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
  const titleFg = colors.titleFg || colors.fg
  const line = `${colors.panel}${" ".repeat(padX)}${colors.bold}${titleFg}${title}${colors.reset}${colors.panel}${" ".repeat(headerGap)}${colors.muted}${headerR}${colors.panel}${" ".repeat(padX)}${colors.reset}`
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
  selStart?: number,
  selEnd?: number,
): string {
  const pad = " ".repeat(padX)
  if (!filter) {
    return `${colors.panel}${pad}${colors.accent}▌${colors.muted} ${truncate("Search", bodyWidth - 2)}${colors.panel}${pad}${colors.reset}`
  }
  const text = truncate(filter, bodyWidth - 2)
  const hasSelection = selStart !== undefined && selEnd !== undefined && selStart < selEnd
  if (!hasSelection) {
    return `${colors.panel}${pad}${colors.accent}▌${colors.fg} ${text}${colors.panel}${pad}${colors.reset}`
  }
  // Selection: split body into before / inside / after; inside gets the
  // theme's selected bg + fg combo (colors.selected). Restore panel bg and
  // default fg after.
  const a = Math.max(0, Math.min(selStart!, text.length))
  const b = Math.max(a, Math.min(selEnd!, text.length))
  const before = text.slice(0, a)
  const inside = text.slice(a, b)
  const after = text.slice(b)
  return `${colors.panel}${pad}${colors.accent}▌${colors.fg} ${before}${colors.selected}${inside}${colors.panel}${colors.fg}${after}${colors.panel}${pad}${colors.reset}`
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
