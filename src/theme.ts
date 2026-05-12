import type { Colors, Theme } from "./types"

export const shadesOfPurple: Theme = {
  bg: "#1e1d40",
  panel: "#2d2b55",
  selected: "#504d7a",
  fg: "#ffffff",
  muted: "#a599e9",
  accent: "#fad000",
}

export const dracula: Theme = {
  bg: "#282a36",
  panel: "#21222c",
  selected: "#44475a",
  fg: "#f8f8f2",
  muted: "#6272a4",
  accent: "#bd93f9",
}

export const tokyoNight: Theme = {
  bg: "#1a1b26",
  panel: "#16161e",
  selected: "#283457",
  fg: "#c0caf5",
  muted: "#565f89",
  accent: "#7aa2f7",
}

export const minimal: Theme = {
  bg: "#000000",
  panel: "#0a0a0a",
  selected: "#1f1f1f",
  fg: "#ffffff",
  muted: "#808080",
  accent: "#ffffff",
}

export const themes: Record<string, Theme> = {
  "shades-of-purple": shadesOfPurple,
  dracula,
  "tokyo-night": tokyoNight,
  minimal,
}

export function resolveTheme(theme: Theme | string | undefined): Theme {
  if (!theme) return shadesOfPurple
  if (typeof theme === "string") {
    const found = themes[theme]
    if (!found) throw new Error(`Unknown theme: ${theme}. Known: ${Object.keys(themes).join(", ")}`)
    return found
  }
  return theme
}

function rgb(hex: string): [number, number, number] {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) throw new Error(`Invalid hex color: ${hex}`)
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)]
}

export function fg(hex: string): string {
  const [r, g, b] = rgb(hex)
  return `\x1b[38;2;${r};${g};${b}m`
}

export function bg(hex: string): string {
  const [r, g, b] = rgb(hex)
  return `\x1b[48;2;${r};${g};${b}m`
}

export function makeColors(theme: Theme): Colors {
  return {
    bg: bg(theme.bg),
    panel: bg(theme.panel),
    selected: bg(theme.selected) + fg(theme.fg),
    fg: fg(theme.fg),
    muted: fg(theme.muted),
    accent: fg(theme.accent),
    reset: "\x1b[0m",
    bold: "\x1b[1m",
  }
}
