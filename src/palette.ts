import { createCliRenderer, BoxRenderable, TextRenderable, TextAttributes, ScrollBoxRenderable } from "@opentui/core"
import type { Item, PaletteDef } from "./types"
import { resolveTheme } from "./theme"
import { dispatchToFile } from "./dispatch"

export function definePalette(def: PaletteDef): PaletteDef {
  return def
}

export async function runPalette(def: PaletteDef): Promise<void> {
  const theme = resolveTheme(def.theme)
  const title = def.title ?? "Commands"
  const grouped = def.grouped !== false
  const emptyText = def.emptyText ?? "No results"
  const cmdFile = process.env.TMUX_PALETTE_CMD

  const items: Item[] = typeof def.items === "function" ? await def.items() : def.items

  const renderer = await createCliRenderer({ exitOnCtrlC: true })

  let filter = ""
  let selected = 0
  let rowIdCounter = 0
  let selectedRowId: string | null = null
  const listChildren: string[] = []

  const root = new BoxRenderable(renderer, {
    id: "root",
    width: "100%",
    height: "100%",
    backgroundColor: theme.panel,
    flexDirection: "column",
    paddingX: 3,
    paddingY: 1,
  })

  const header = new BoxRenderable(renderer, {
    id: "header",
    width: "100%",
    height: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  })
  header.add(new TextRenderable(renderer, {
    id: "h-title",
    content: title,
    fg: theme.fg,
    attributes: TextAttributes.BOLD,
  }))
  header.add(new TextRenderable(renderer, {
    id: "h-esc",
    content: "esc",
    fg: theme.muted,
    onMouseDown: () => exit(),
  }))

  const search = new BoxRenderable(renderer, {
    id: "search",
    width: "100%",
    height: 1,
    flexDirection: "row",
  })
  const searchCursor = new TextRenderable(renderer, {
    id: "search-cursor",
    content: "▌",
    fg: theme.accent,
  })
  const searchText = new TextRenderable(renderer, {
    id: "search-text",
    content: " Search",
    fg: theme.muted,
  })
  search.add(searchCursor)
  search.add(searchText)

  const spacer = new TextRenderable(renderer, { id: "spacer", content: "" })

  const list = new ScrollBoxRenderable(renderer, {
    id: "list",
    width: "100%",
    flexGrow: 1,
    scrollY: true,
    scrollX: false,
    viewportCulling: false,
    contentOptions: { flexDirection: "column" },
    onMouseScroll: (event: any) => {
      const vis = visible()
      if (!vis.length) return
      const dir = event.scroll?.direction
      if (dir === "up") {
        selected = (selected - 1 + vis.length) % vis.length
        render()
      } else if (dir === "down") {
        selected = (selected + 1) % vis.length
        render()
      }
    },
  })

  const footerSpacer = new TextRenderable(renderer, { id: "footerSpacer", content: "" })
  const footer = new TextRenderable(renderer, { id: "footer", content: "", fg: theme.muted })

  list.verticalScrollBar.visible = false
  list.horizontalScrollBar.visible = false

  root.add(header)
  root.add(search)
  root.add(spacer)
  root.add(list)
  root.add(footerSpacer)
  root.add(footer)
  renderer.root.add(root)

  // Initials of multi-word titles. "New Window" -> "nw", "Move Pane to..." -> "mpt".
  // Used as an invisible searchable alias; not rendered as a chip.
  function autoAlias(title: string): string | null {
    const words = title.split(/\s+/).filter((w) => /^[a-z]/i.test(w))
    if (words.length < 2) return null
    return words.map((w) => w[0]!).join("").toLowerCase()
  }

  function visible(): Item[] {
    const needle = filter.trim()
    if (!needle) return items
    if (def.filter) return def.filter(items, needle)
    const needleLower = needle.toLowerCase()
    return items.filter((c) => {
      const auto = autoAlias(c.title)
      const haystack = [c.title, c.description, c.category, c.shortcut, ...(c.aliases ?? []), auto]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return needleLower.split(/\s+/).every((p) => haystack.includes(p))
    })
  }

  function exit(): void {
    renderer.destroy()
    process.exit(0)
  }

  async function activate(item: Item): Promise<void> {
    renderer.destroy()
    const action = item.action
    if ("run" in action) {
      await action.run({ cmdFile })
      process.exit(0)
    }
    dispatchToFile(action, cmdFile)
    process.exit(0)
  }

  function buildRow(item: Item, active: boolean): BoxRenderable {
    const id = `row-${rowIdCounter++}`
    listChildren.push(id)
    if (active) selectedRowId = id

    if (def.renderItem) {
      const custom = def.renderItem(item, { theme, active, id, renderer })
      if (isSelectable(item)) {
        ;(custom as any).onMouseDown = () => { void activate(item) }
      }
      return custom as BoxRenderable
    }

    const row = new BoxRenderable(renderer, {
      id,
      width: "100%",
      height: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: active ? theme.selected : theme.panel,
      onMouseDown: () => { void activate(item) },
    })

    const left = new BoxRenderable(renderer, {
      id: `${id}-l`,
      flexDirection: "row",
      flexShrink: 1,
      height: 1,
    })
    left.add(new TextRenderable(renderer, {
      id: `${id}-marker`,
      content: `${active ? "▌" : " "} `,
      fg: theme.accent,
    }))
    left.add(new TextRenderable(renderer, {
      id: `${id}-icon`,
      content: `${item.icon ?? " "}  `,
      fg: theme.accent,
    }))
    left.add(new TextRenderable(renderer, {
      id: `${id}-t`,
      content: item.title,
      fg: active ? theme.fg : theme.muted,
      attributes: active ? TextAttributes.BOLD : 0,
    }))
    if (item.aliases?.length) {
      left.add(new TextRenderable(renderer, {
        id: `${id}-a`,
        content: `  ${item.aliases[0]} `,
        fg: theme.muted,
        bg: theme.bg,
      }))
    }
    if (item.description) {
      left.add(new TextRenderable(renderer, {
        id: `${id}-d`,
        content: ` - ${item.description}`,
        fg: theme.muted,
      }))
    }
    row.add(left)

    if (item.shortcut) {
      row.add(new TextRenderable(renderer, {
        id: `${id}-s`,
        content: `${item.shortcut} `,
        fg: active ? theme.accent : theme.muted,
      }))
    }

    return row
  }

  function buildCategoryHeader(category: string): BoxRenderable {
    const id = `cat-${rowIdCounter++}`
    listChildren.push(id)
    const box = new BoxRenderable(renderer, {
      id,
      width: "100%",
      height: 1,
      flexDirection: "row",
    })
    box.add(new TextRenderable(renderer, {
      id: `${id}-t`,
      content: category,
      fg: theme.accent,
      attributes: TextAttributes.BOLD,
    }))
    return box
  }

  function isSelectable(item: Item | undefined): boolean {
    return !!item && item.selectable !== false
  }

  function firstSelectable(vis: Item[]): number {
    for (let i = 0; i < vis.length; i++) if (isSelectable(vis[i])) return i
    return -1
  }

  function lastSelectable(vis: Item[]): number {
    for (let i = vis.length - 1; i >= 0; i--) if (isSelectable(vis[i])) return i
    return -1
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

  function clampSelected(vis: Item[]): void {
    if (selected < 0 || selected >= vis.length || !isSelectable(vis[selected])) {
      const first = firstSelectable(vis)
      selected = first >= 0 ? first : 0
    }
  }

  function render(): void {
    const vis = visible()
    clampSelected(vis)

    searchText.content = filter ? ` ${filter}` : " Search"
    ;(searchText as any).fg = filter ? theme.fg : theme.muted

    for (const id of listChildren) list.remove(id)
    listChildren.length = 0
    selectedRowId = null

    let lastCat = ""
    vis.forEach((item, i) => {
      if (grouped && !filter && item.category && item.category !== lastCat) {
        list.add(buildCategoryHeader(item.category))
        lastCat = item.category
      }
      list.add(buildRow(item, i === selected))
    })

    footer.content = vis.length
      ? `enter select   up/down move   ${vis.length} ${vis.length === 1 ? "command" : "commands"}`
      : emptyText

    if (selectedRowId) list.scrollChildIntoView(selectedRowId)
  }

  render()

  renderer.keyInput.on("keypress", (key) => {
    const vis = visible()
    if (key.name === "escape") return exit()
    if (key.name === "return") {
      const item = vis[selected]
      if (item && isSelectable(item)) void activate(item)
      return
    }
    if (key.name === "up" || (key.ctrl && key.name === "p")) {
      selected = step(vis, selected, -1)
    } else if (key.name === "down" || (key.ctrl && key.name === "n")) {
      selected = step(vis, selected, 1)
    } else if (key.name === "pageup") {
      let s = selected
      for (let n = 0; n < 10; n++) s = step(vis, s, -1)
      selected = s
    } else if (key.name === "pagedown") {
      let s = selected
      for (let n = 0; n < 10; n++) s = step(vis, s, 1)
      selected = s
    } else if (key.name === "backspace") {
      filter = filter.slice(0, -1)
      selected = 0
    } else if (!key.ctrl && !key.meta && key.sequence && key.sequence.length === 1 && key.sequence >= " " && key.sequence !== "\x7f") {
      filter += key.sequence
      selected = 0
    } else {
      return
    }
    render()
  })
}
