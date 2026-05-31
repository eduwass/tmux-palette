import { describe, expect, test } from "bun:test"
import {
  buildRows,
  composeListBody,
  firstSelectable,
  isSelectable,
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

  test("can stop at list ends instead of wrapping", () => {
    expect(step(items, 2, 1, false)).toBe(2)
    expect(step(items, 0, -1, false)).toBe(0)
    expect(step(items, 0, 1, false)).toBe(2)
    expect(step(items, 2, -1, false)).toBe(0)
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
