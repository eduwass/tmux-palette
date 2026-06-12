// Bundled themes are intentionally curated. Custom themes can still be added
// via ~/.config/tmux-palette/themes/*.json.

import type { Theme } from "./types"

export type BundledTheme = { slug: string; name: string; theme: Theme }

export const bundledThemes: BundledTheme[] = [
  { slug: "shades-of-purple", name: "Shades of Purple", theme: {
    bg: "#1e1d40", panel: "#2d2b55", selected: "#504d7a",
    fg: "#ffffff", muted: "#a599e9", accent: "#fad000",
  }},
  { slug: "dracula", name: "Dracula", theme: {
    bg: "#282a36", panel: "#45495d", selected: "#6a6f8f",
    fg: "#f8f8f2", muted: "#bdc3d8", accent: "#d6acff",
  }},
  { slug: "tokyo-night", name: "Tokyo Night", theme: {
    bg: "#1a1b26", panel: "#34354b", selected: "#53567a",
    fg: "#c0caf5", muted: "#99a0bf", accent: "#7aa2f7",
  }},
  { slug: "catppuccin-mocha", name: "Catppuccin Mocha", theme: {
    bg: "#1e1e2e", panel: "#383857", selected: "#5a5a8b",
    fg: "#cdd6f4", muted: "#a6a9b9", accent: "#89b4fa",
  }},
  { slug: "gruvbox-dark", name: "Gruvbox Dark", theme: {
    bg: "#282828", panel: "#414141", selected: "#646464",
    fg: "#ebdbb2", muted: "#b7ada4", accent: "#8ec07c",
  }},
  { slug: "rose-pine", name: "Rosé Pine", theme: {
    bg: "#191724", panel: "#3c3857", selected: "#645c8f",
    fg: "#e0def4", muted: "#b1aebf", accent: "#9ccfd8",
  }},
  { slug: "nord", name: "Nord", theme: {
    bg: "#2e3440", panel: "#3f4758", selected: "#5c677f",
    fg: "#d8dee9", muted: "#abb2c0", accent: "#88c0d0",
  }},
  { slug: "solarized-dark", name: "Solarized Dark", theme: {
    bg: "#002b36", panel: "#00333f", selected: "#00485b",
    fg: "#839496", muted: "#4a8897", accent: "#268bd2",
  }},
  { slug: "kanagawa-wave", name: "Kanagawa Wave", theme: {
    bg: "#1f1f28", panel: "#3a3a4b", selected: "#5c5c77",
    fg: "#dcd7ba", muted: "#b4aa6c", accent: "#7e9cd8",
  }},
  { slug: "github-dark", name: "GitHub Dark", theme: {
    bg: "#101216", panel: "#1e2129", selected: "#363c4a",
    fg: "#8b949e", muted: "#707a85", accent: "#6ca4f8",
  }},
  { slug: "one-dark", name: "One Dark", theme: {
    bg: "#21252b", panel: "#2f353d", selected: "#48505e",
    fg: "#abb2bf", muted: "#8691a3", accent: "#61afef",
  }},
  { slug: "ayu-dark", name: "Ayu Dark", theme: {
    bg: "#0b0e14", panel: "#242e41", selected: "#3f5072",
    fg: "#bfbdb6", muted: "#98958a", accent: "#53bdfa",
  }},
  // Fully terminal-native: backgrounds are transparent (terminal shows
  // through), entry labels and muted text use the terminal's own foreground so
  // they stay legible on any light or dark scheme, icons/marker/title use the
  // terminal blue, and the highlighted row turns the terminal yellow.
  { slug: "terminal", name: "Terminal", theme: {
    bg: "transparent", panel: "transparent", selected: "transparent",
    fg: "transparent", muted: "transparent", accent: "blue",
    selectedFg: "yellow", titleFg: "blue",
  }},
]

export const bundledThemeMap: Record<string, Theme> =
  Object.fromEntries(bundledThemes.map((t) => [t.slug, t.theme]))
