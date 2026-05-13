export type PopupAction = {
  popup: string
  /** Override sizing.popupWidth ("80" cells or "80%"). */
  width?: string
  /** Override sizing.popupHeight. */
  height?: string
  /** Override sizing.popupPadX (cells removed from each side). */
  padX?: number
  /** Override sizing.popupPadY. */
  padY?: number
  /** Override sizing.popupBorder ("none" | "single" | "rounded" | …). */
  border?: string
}

export type Action =
  | { tmux: string }
  | { shell: string }
  | { palette: string }
  | PopupAction
  | { run: (ctx: ActionContext) => void | Promise<void> }
  /**
   * Like `run`, but runs in-process WITHOUT closing the popup. After the
   * callback completes, the runner navigates back to the previous palette
   * (or closes if at the root). Use for actions that mutate config and
   * should "apply + return" rather than "apply + exit". The theme switcher
   * uses this so picking a theme returns you to the commands palette.
   */
  | { apply: (ctx: ActionContext) => void | Promise<void> }

export interface ActionContext {
  readonly cmdFile: string | undefined
}

export type Item = {
  icon?: string
  /**
   * Optional hex color (e.g. "#22cc22") applied to the icon. When unset,
   * the theme accent color is used. Useful for status indicators where
   * the icon glyph stays the same but the color encodes state.
   */
  iconColor?: string
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
  /**
   * Restricts visibility by filter state.
   *   "filter"    — only shown when the user has typed a query (hidden by default).
   *   "no-filter" — only shown when no query is active (e.g. Recent entries).
   * Default: always shown.
   */
  showWhen?: "filter" | "no-filter"
}

export type Theme = {
  bg: string
  panel: string
  selected: string
  fg: string
  muted: string
  accent: string
}

/** Pre-built ANSI escape sequences derived from a Theme. Pass to renderItem. */
export type Colors = {
  bg: string
  panel: string
  selected: string
  fg: string
  muted: string
  accent: string
  reset: string
  bold: string
}

export type RenderItemCtx = {
  colors: Colors
  active: boolean
  /** Body width available for the row (popup width minus horizontal padding). */
  width: number
}

export type PaletteDef = {
  title?: string
  items: Item[] | (() => Item[] | Promise<Item[]>)
  theme?: Theme | string
  grouped?: boolean
  emptyText?: string
  /**
   * Custom row renderer. Return the row's content as an ANSI-styled string;
   * the framework pads/truncates to width and wraps with selection background.
   * Use for tree views, multi-column layouts, anything the default doesn't fit.
   */
  renderItem?: (item: Item, ctx: RenderItemCtx) => string
  /**
   * Custom filter. Useful when items have parent/child relationships and
   * matching a child should keep its ancestors visible. Defaults to substring
   * match across title/description/category/shortcut/aliases (+ auto-aliases).
   */
  filter?: (items: Item[], query: string) => Item[]
  /**
   * Called when the highlighted item changes (arrow keys, mouse, filter
   * reset). Return a Theme to live-preview it — the renderer swaps colors
   * before the next frame paints. Used by the theme switcher.
   */
  onSelect?: (item: Item | undefined) => Theme | undefined
  /**
   * Picks the initial highlighted item. Receives the resolved items and
   * returns an index (or -1 to use the first selectable). Used by find-pane
   * to start the cursor on the user's current pane.
   */
  initialSelected?: (items: Item[]) => number
}
