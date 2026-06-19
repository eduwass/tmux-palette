import type { Action } from "../types"

export type HostPane = {
  session: string
  windowIndex: string
  paneIndex: string
  windowName: string
  paneTitle: string
  command: string
  path: string
  agent: string
  paneActive: boolean
  windowActive: boolean
  isCurrent: boolean
  target: string
}

export type HostWindowTarget = { session: string; windowIndex: string; windowName: string; targetPaneId?: string }

export type HostMovePaneState = {
  paneId: string
  currentWindow: string
  sessions: string[]
  windows: HostWindowTarget[]
}

export type PaletteHost = {
  id: string
  listPanes?: () => { panes: HostPane[]; currentSession: string }
  focusSession?: (session: string) => Action
  focusWindow?: (session: string, windowIndex: string) => Action
  focusPane?: (pane: HostPane) => Action
  movePaneState?: () => HostMovePaneState
  movePaneToNewWindow?: (paneId: string, session: string) => Action
  movePaneToWindow?: (paneId: string, target: HostWindowTarget) => Action
}
