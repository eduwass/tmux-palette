import { describe, expect, test } from "bun:test"
import {
  buildRows,
  composeHeader,
  composeListBody,
  firstSelectable,
  isSelectable,
  renderDefaultItem,
  step,
  type Row,
} from "../src/render"
import type { Colors, Item } from "../src/types"

const action = { shell: ":" } as const
const items: Item[] = [
  { title: "Find Pane", category: "Panes", action },
  { title: "Section", category: "Panes", selectable: false, action },
  { title: "New Window", category: "Windows", action },
]

const colors: Colors = {
  bg: "",
  panel: "",
  selected: "",
  fg: "",
  muted: "",
  accent: "",
  selectedFg: "",
  titleFg: "",
  reset: "",
  bold: "",
}

describe("selection helpers", () => {
  test("treats items as selectable unless explicitly disabled", () => {
    expect(isSelectable(items[0])).toBe(true)
    expect(isSelectable(items[1])).toBe(false)
  })

  test("finds and steps over non-selectable items", () => {
    expect(firstSelectable(items)).toBe(0)
    expect(step(items, 0, 1)).toBe(2)
    expect(step(items, 2, -1)).toBe(0)
  })
})

describe("buildRows", () => {
  test("adds category rows when grouped and unfiltered", () => {
    expect(buildRows(items, true, false).map((r) => r.kind === "category" ? r.category : r.item.title))
      .toEqual(["Panes", "Find Pane", "Section", "Windows", "New Window"])
  })

  test("omits category rows while filtering", () => {
    expect(buildRows(items, true, true).map((r) => r.kind)).toEqual(["item", "item", "item"])
  })
})

describe("composeHeader title color", () => {
  const base: Colors = {
    bg: "", panel: "", selected: "", fg: "FG", muted: "MUT",
    accent: "ACC", selectedFg: "", titleFg: "", reset: "", bold: "",
  }

  test("title uses fg when titleFg unset", () => {
    expect(composeHeader("Commands", 40, 1, 38, base).line).toContain("FGCommands")
  })

  test("title uses titleFg when set", () => {
    const line = composeHeader("Commands", 40, 1, 38, { ...base, titleFg: "MAG" }).line
    expect(line).toContain("MAGCommands")
    expect(line).not.toContain("FGCommands")
  })
})

describe("renderDefaultItem active highlight", () => {
  // Sentinel color codes so we can assert which field colored each fragment.
  const c: Colors = {
    bg: "", panel: "", selected: "", fg: "FG", muted: "MUT",
    accent: "ACC", selectedFg: "", titleFg: "", reset: "", bold: "",
  }
  const item: Item = { title: "Split", icon: "I", shortcut: "C-s", action }

  test("active row uses accent (icon/marker) and fg (title) when selectedFg unset", () => {
    const out = renderDefaultItem(item, c, true, 40)
    expect(out).toContain("ACC▌") // marker
    expect(out).toContain("ACC") // icon + active shortcut
    expect(out).toContain("FGSplit") // bold "" + fg + title
    expect(out).not.toContain("SEL")
  })

  test("active row uses selectedFg for icon, marker, title, and shortcut when set", () => {
    const out = renderDefaultItem(item, { ...c, selectedFg: "SEL" }, true, 40)
    expect(out).toContain("SEL▌") // marker
    expect(out).toContain("SELSplit") // title
    expect(out.match(/SEL/g)?.length).toBeGreaterThanOrEqual(3) // marker + icon + title + shortcut
  })

  test("inactive icon stays on accent regardless of selectedFg", () => {
    const out = renderDefaultItem(item, { ...c, selectedFg: "SEL" }, false, 40)
    expect(out).toContain("ACC") // icon uses accent on inactive rows
    expect(out).toContain("MUTSplit") // inactive title is muted
  })
})

describe("composeListBody", () => {
  test("tracks row actions only for item rows", () => {
    const rows: Row[] = buildRows(items, true, false)
    const body = composeListBody(rows, 0, 3, 0, 20, 1, colors, 10, (row) =>
      row.kind === "category" ? row.category : row.item.title)

    expect(body.lines).toHaveLength(3)
    expect(body.rowActions).toEqual([
      { y: 11, itemIndex: 0 },
      { y: 12, itemIndex: 1 },
    ])
  })
})
