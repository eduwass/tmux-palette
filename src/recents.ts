import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

const CONFIG_DIR =
  `${process.env.XDG_CONFIG_HOME ?? `${process.env.HOME ?? ""}/.config`}/tmux-palette`
const RECENT_FILE = `${CONFIG_DIR}/recent.json`
const MAX_RECENT = 8

export function getRecent(): string[] {
  try {
    const parsed = JSON.parse(readFileSync(RECENT_FILE, "utf8"))
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : []
  } catch {
    return []
  }
}

export function recordRecent(title: string): void {
  if (!title) return
  const list = getRecent().filter((t) => t !== title)
  list.unshift(title)
  const trimmed = list.slice(0, MAX_RECENT)
  try {
    mkdirSync(dirname(RECENT_FILE), { recursive: true })
    writeFileSync(RECENT_FILE, JSON.stringify(trimmed), "utf8")
  } catch {}
}
