import { dispatchToFile } from "./dispatch"
import { makeColors, resolveTheme } from "./theme"
import type { Colors, Item, PaletteDef } from "./types"
import { userAliases, userShortcuts, userTheme } from "./userConfig"

export function definePalette(def: PaletteDef): PaletteDef {
  return def
}

function strip(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "")
}

function charWidth(c: string): number {
  const code = c.codePointAt(0) ?? 0
  if (code === 0) return 0
  if (code < 32 || (code >= 0x7f && code < 0xa0)) return 0
  if (
    code >= 0x1100 &&
    (code <= 0x115f ||
      code === 0x2329 ||
      code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf000 && code <= 0xf8ff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f300 && code <= 0x1faff))
  ) return 2
  return 1
}

function displayWidth(s: string): number {
  return Array.from(strip(s)).reduce((w, c) => w + charWidth(c), 0)
}

function truncate(s: string, width: number): string {
  const current = displayWidth(s)
  if (current <= width) return s + " ".repeat(width - current)
  const plain = strip(s)
  let result = ""
  let used = 0
  for (const c of Array.from(plain)) {
    const next = used + charWidth(c)
    if (next >= width) break
    result += c
    used = next
  }
  return result + "…" + " ".repeat(Math.max(0, width - used - 1))
}

function autoAlias(title: string): string | null {
  const words = title.split(/\s+/).filter((w) => /^[a-z]/i.test(w))
  if (words.length < 2) return null
  return words.map((w) => w[0]!).join("").toLowerCase()
}

const BOUNDARY = /[\s\-_·./:]/
export function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1
  const hs = haystack.toLowerCase()
  const nd = needle.toLowerCase()

  const idx = hs.indexOf(nd)
  if (idx !== -1) {
    const atBoundary = idx === 0 || BOUNDARY.test(hs[idx - 1] ?? "")
    return 10000 + (atBoundary ? 5000 : 0) - idx
  }

  let score = 0
  let h = 0
  let prev = -2
  for (let n = 0; n < nd.length; n++) {
    const target = nd[n]
    while (h < hs.length && hs[h] !== target) h++
    if (h >= hs.length) return 0
    const atBoundary = h === 0 || BOUNDARY.test(hs[h - 1] ?? "")
    if (atBoundary) score += 50
    else if (h === prev + 1) score += 20
    else score += 5
    prev = h
    h++
  }
  return Math.max(1, score)
}

export function multiFuzzyScore(haystack: string, parts: string[]): number {
  let total = 0
  for (const p of parts) {
    const s = fuzzyScore(haystack, p)
    if (s === 0) return 0
    total += s
  }
  return total
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
  type RowAction = { y: number; itemIndex: number }
  let rowActions: RowAction[] = []
  let escAction: { y: number; xStart: number; xEnd: number } | undefined

  const stdin = process.stdin
  const stdout = process.stdout

  if (!stdin.isTTY || !stdout.isTTY || !stdin.setRawMode) {
    console.error("palette requires an interactive terminal")
    process.exit(1)
  }

  function isSelectable(item: Item | undefined): boolean {
    return !!item && item.selectable !== false
  }

  function step(vis: Item[], from: number, dir: 1 | -1): number {
    if (!vis.length) return 0
    let i = from
    for (let n = 0; n < vis.length; n++) {
      i = (i + dir + vis.length) % vis.length
      if (isSelectable(vis[i])) return i
    }
    return from
  }

  function firstSelectable(vis: Item[]): number {
    for (let i = 0; i < vis.length; i++) if (isSelectable(vis[i])) return i
    return -1
  }

  function visible(): Item[] {
    const needle = filter.trim()
    if (!needle) return items
    if (def.filter) return def.filter(items, needle)
    const parts = needle.split(/\s+/).filter(Boolean)
    return items
      .map((c) => {
        const auto = autoAlias(c.title)
        const haystack = [c.title, c.description, c.category, c.shortcut, ...(c.aliases ?? []), auto]
          .filter(Boolean)
          .join(" ")
        return { item: c, score: multiFuzzyScore(haystack, parts) }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item)
  }

  stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding("utf8")
  stdout.write("\x1b[?1000h\x1b[?1006h\x1b[?25l")

  function defaultRenderItem(item: Item, active: boolean, bodyWidth: number): string {
    const rowBg = active ? colors.selected : colors.panel
    const marker = active ? `${colors.accent}▌${colors.reset}${rowBg}` : " "
    const icon = item.icon ? `${colors.accent}${item.icon}${colors.reset}${rowBg}` : " "
    const titleStyle = active ? colors.bold + colors.fg : colors.muted
    const titleStyled = `${titleStyle}${item.title}${colors.reset}${rowBg}`

    let leftStyled = `${marker} ${icon}  ${titleStyled}`
    let leftPlainW = 1 + 1 + charWidth(item.icon ?? " ") + 2 + displayWidth(item.title)

    if (item.aliases?.length) {
      const chip = `  ${colors.bg} ${item.aliases[0]} ${colors.reset}${rowBg}`
      leftStyled += chip
      leftPlainW += 2 + 1 + item.aliases[0]!.length + 1
    }
    if (item.description) {
      leftStyled += `${colors.muted} - ${item.description}${colors.reset}${rowBg}`
      leftPlainW += 3 + item.description.length
    }

    const scText = item.shortcut ?? ""
    const scStyled = scText
      ? `${active ? colors.accent : colors.muted}${scText}${colors.reset}${rowBg}`
      : ""

    const gap = Math.max(1, bodyWidth - leftPlainW - scText.length)
    return leftStyled + " ".repeat(gap) + scStyled
  }

  function renderCategory(category: string, rowBg: string): string {
    return `${colors.accent}${colors.bold}${category}${colors.reset}${rowBg}`
  }

  function render(): void {
    const width = stdout.columns ?? 80
    const height = stdout.rows ?? 24
    const vis = visible()

    if (!isSelectable(vis[selected])) {
      const f = firstSelectable(vis)
      selected = f >= 0 ? f : 0
    }

    type Row =
      | { kind: "category"; category: string }
      | { kind: "item"; item: Item; itemIndex: number }
    const rows: Row[] = []
    let lastCat = ""
    vis.forEach((item, i) => {
      if (grouped && !filter && item.category && item.category !== lastCat) {
        rows.push({ kind: "category", category: item.category })
        lastCat = item.category
      }
      rows.push({ kind: "item", item, itemIndex: i })
    })

    // Chrome rows: top pad + header + search + spacer + footer spacer + footer + bottom pad = 7
    const listHeight = Math.max(1, height - 7)

    const selectedRowIdx = rows.findIndex((r) => r.kind === "item" && r.itemIndex === selected)
    if (selectedRowIdx >= 0) {
      if (selectedRowIdx < scroll) scroll = selectedRowIdx
      if (selectedRowIdx >= scroll + listHeight) scroll = selectedRowIdx - listHeight + 1
    }
    scroll = Math.max(0, Math.min(scroll, Math.max(0, rows.length - listHeight)))

    const padX = 3
    const innerWidth = width - padX * 2
    const bodyWidth = innerWidth // content area inside left/right padding
    const blank = " ".repeat(width)
    const out: string[] = []

    out.push(`${colors.panel}${blank}${colors.reset}`)

    const headerR = "esc"
    const titleW = displayWidth(title)
    const headerRW = displayWidth(headerR)
    const headerGap = Math.max(0, innerWidth - titleW - headerRW)
    out.push(
      `${colors.panel}${" ".repeat(padX)}${colors.bold}${colors.fg}${title}${colors.reset}${colors.panel}${" ".repeat(headerGap)}${colors.muted}${headerR}${colors.panel}${" ".repeat(padX)}${colors.reset}`,
    )
    escAction = { y: 2, xStart: Math.max(1, width - padX - headerRW), xEnd: width - padX + 1 }

    const searchValue = filter || "Search"
    const searchColor = filter ? colors.fg : colors.muted
    out.push(
      `${colors.panel}${" ".repeat(padX)}${colors.accent}▌${searchColor} ${truncate(searchValue, bodyWidth - 2)}${colors.panel}${" ".repeat(padX)}${colors.reset}`,
    )

    out.push(`${colors.panel}${blank}${colors.reset}`)

    rowActions = []
    let drawn = 0
    for (let i = scroll; i < rows.length && drawn < listHeight; i++) {
      const row = rows[i]!
      const isSelected = row.kind === "item" && row.itemIndex === selected
      const rowBg = isSelected ? colors.selected : colors.panel

      let content: string
      if (row.kind === "category") {
        content = renderCategory(row.category, rowBg)
      } else if (def.renderItem) {
        content = def.renderItem(row.item, { colors, active: isSelected, width: bodyWidth })
      } else {
        content = defaultRenderItem(row.item, isSelected, bodyWidth)
      }

      if (row.kind === "item") {
        rowActions.push({ y: 5 + drawn, itemIndex: row.itemIndex })
      }

      out.push(`${rowBg}${" ".repeat(padX)}${truncate(content, bodyWidth)}${" ".repeat(padX)}${colors.reset}`)
      drawn++
    }
    while (drawn++ < listHeight) {
      out.push(`${colors.panel}${blank}${colors.reset}`)
    }

    out.push(`${colors.panel}${blank}${colors.reset}`)

    const selectableCount = vis.filter(isSelectable).length
    const footerText = selectableCount
      ? `enter select   up/down move   ${selectableCount} ${selectableCount === 1 ? "command" : "commands"}`
      : emptyText
    out.push(
      `${colors.panel}${" ".repeat(padX)}${colors.muted}${truncate(footerText, bodyWidth)}${colors.panel}${" ".repeat(padX)}${colors.reset}`,
    )

    out.push(`${colors.panel}${blank}${colors.reset}`)

    // Synchronized output + cursor-home (no clear) so the frame swaps
    // atomically without a blank flash, even when arrow keys repeat fast.
    stdout.write("\x1b[?2026h\x1b[?25l\x1b[H" + out.join("\n") + "\x1b[?2026l")
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

  stdin.on("data", (key: string) => {
    const vis = visible()

    // SGR mouse: press+release sometimes arrive in one chunk on some terminals,
    // so don't anchor to end-of-string.
    const mouse = /^\x1b\[<(?<button>\d+);(?<x>\d+);(?<y>\d+)(?<kind>[mM])/.exec(key)
    if (mouse?.groups) {
      const button = Number(mouse.groups.button)
      const x = Number(mouse.groups.x)
      const y = Number(mouse.groups.y)
      if (button === 64) {
        selected = step(vis, selected, -1)
      } else if (button === 65) {
        selected = step(vis, selected, 1)
      } else if (button === 0 && mouse.groups.kind === "M") {
        if (escAction && y === escAction.y && x >= escAction.xStart && x <= escAction.xEnd) {
          exitNow()
        }
        const hit = rowActions.find((r) => r.y === y)
        if (hit) {
          const item = vis[hit.itemIndex]
          if (item && isSelectable(item)) {
            selected = hit.itemIndex
            void activate(item)
            return
          }
        }
      }
      render()
      return
    }

    if (key === "" || key === "") exitNow()
    if (key === "\r") {
      const item = vis[selected]
      if (item && isSelectable(item)) void activate(item)
      return
    }
    if (key === "") {
      filter = filter.slice(0, -1)
      selected = 0
      scroll = 0
      render()
      return
    }
    if (key === "[A" || key === "") {
      selected = step(vis, selected, -1)
    } else if (key === "[B" || key === "") {
      selected = step(vis, selected, 1)
    } else if (key === "[5~") {
      for (let i = 0; i < 10; i++) selected = step(vis, selected, -1)
    } else if (key === "[6~") {
      for (let i = 0; i < 10; i++) selected = step(vis, selected, 1)
    } else if (key.length === 1 && key >= " " && key !== "") {
      filter += key
      selected = 0
      scroll = 0
    } else {
      return
    }
    render()
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
