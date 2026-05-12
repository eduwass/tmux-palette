export type Action =
  | { tmux: string }
  | { shell: string }
  | { palette: string }
  | { run: (ctx: ActionContext) => void | Promise<void> }

export interface ActionContext {
  readonly cmdFile: string | undefined
}

export type Item = {
  icon?: string
  title: string
  description?: string
  shortcut?: string
  category?: string
  aliases?: string[]
  action: Action
  /** Arbitrary payload for custom renderItem implementations. */
  data?: unknown
  /**
   * When false, the cursor skips this item (arrow keys/initial selection/click).
   * Use for visual-only rows like section headers in tree palettes.
   * Defaults to true.
   */
  selectable?: boolean
}

export type RenderItemCtx = {
  theme: Theme
  active: boolean
  id: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderer: any
}

export type Theme = {
  bg: string
  panel: string
  selected: string
  fg: string
  muted: string
  accent: string
}

export type PaletteDef = {
  title?: string
  items: Item[] | (() => Item[] | Promise<Item[]>)
  theme?: Theme | string
  grouped?: boolean
  emptyText?: string
  /**
   * Custom row renderer. When set, called per visible item to produce the
   * row's Renderable. Use for tree views, multi-column layouts, anything the
   * default layout doesn't fit. The framework attaches the click handler
   * automatically.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderItem?: (item: Item, ctx: RenderItemCtx) => any
  /**
   * Custom filter. Useful when the items have parent/child relationships
   * (tree views) and matching a child should keep its ancestors visible.
   * Called with all items + the trimmed query; returns the visible subset.
   * Falls back to substring match across title/description/category/shortcut/aliases.
   */
  filter?: (items: Item[], query: string) => Item[]
}
