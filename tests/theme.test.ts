import { describe, expect, test } from "bun:test"
import { bundledThemeMap } from "../src/themes-bundled"
import { cursorTint, makeColors, tmuxBodyStyle, tmuxColor } from "../src/theme"
import type { Theme } from "../src/types"

const hexTheme: Theme = {
  bg: "#1a1b26",
  panel: "#34354b",
  selected: "#53567a",
  fg: "#c0caf5",
  muted: "#99a0bf",
  accent: "#7aa2f7",
}

describe("makeColors", () => {
  test("emits 24-bit ANSI codes for hex themes", () => {
    const c = makeColors(hexTheme)
    expect(c.panel).toBe("\x1b[48;2;52;53;75m")
    expect(c.fg).toBe("\x1b[38;2;192;202;245m")
    // selected combines background + foreground
    expect(c.selected).toBe("\x1b[48;2;83;86;122m\x1b[38;2;192;202;245m")
  })

  test("emits default-background (\\x1b[49m) for transparent bg fields", () => {
    const c = makeColors({ ...hexTheme, panel: "transparent", selected: "transparent" })
    expect(c.panel).toBe("\x1b[49m")
    // transparent selected bg + still-hex fg
    expect(c.selected).toBe("\x1b[49m\x1b[38;2;192;202;245m")
  })

  test("emits default-foreground (\\x1b[39m) for transparent fg fields", () => {
    const c = makeColors({ ...hexTheme, fg: "transparent", muted: "transparent" })
    expect(c.fg).toBe("\x1b[39m")
    expect(c.muted).toBe("\x1b[39m")
  })

  test("selectedFg is empty when unset and an fg code when set", () => {
    expect(makeColors(hexTheme).selectedFg).toBe("")
    expect(makeColors({ ...hexTheme, selectedFg: "#fabd2f" }).selectedFg)
      .toBe("\x1b[38;2;250;189;47m")
  })

  test("maps palette color names to the terminal's own ANSI colors", () => {
    const c = makeColors({
      ...hexTheme, accent: "blue", selectedFg: "yellow",
      muted: "bright-black", panel: "red",
    })
    expect(c.accent).toBe("\x1b[34m") // foreground blue
    expect(c.selectedFg).toBe("\x1b[33m") // foreground yellow
    expect(c.muted).toBe("\x1b[90m") // bright-black (gray) foreground
    expect(c.panel).toBe("\x1b[41m") // background red
  })

  test("maps bright background names to the 10X range", () => {
    expect(makeColors({ ...hexTheme, panel: "bright-blue" }).panel).toBe("\x1b[104m")
  })
})

describe("tmuxColor", () => {
  test("translates transparent, names, and hex for tmux style strings", () => {
    expect(tmuxColor("transparent")).toBe("default")
    expect(tmuxColor("blue")).toBe("blue")
    expect(tmuxColor("bright-black")).toBe("brightblack")
    expect(tmuxColor("#1a1b26")).toBe("#1a1b26")
  })
})

describe("cursorTint", () => {
  test("emits OSC 12 for hex accents only", () => {
    expect(cursorTint({ ...hexTheme, accent: "#7aa2f7" })).toBe("\x1b]12;#7aa2f7\x07")
    expect(cursorTint({ ...hexTheme, accent: "blue" })).toBe("")
    expect(cursorTint({ ...hexTheme, accent: "transparent" })).toBe("")
  })
})

describe("tmuxBodyStyle", () => {
  test("uses the panel hex for solid themes", () => {
    expect(tmuxBodyStyle(hexTheme)).toBe("bg=#34354b")
  })

  test("falls back to bg=default when the panel is transparent", () => {
    expect(tmuxBodyStyle({ ...hexTheme, panel: "transparent" })).toBe("bg=default")
  })
})

describe("bundled terminal theme", () => {
  test("resolves and uses terminal-native colors", () => {
    const terminal = bundledThemeMap["terminal"]
    expect(terminal).toBeDefined()
    expect(terminal!.bg).toBe("transparent")
    expect(terminal!.panel).toBe("transparent")
    expect(terminal!.selected).toBe("transparent")
    expect(terminal!.fg).toBe("transparent")
    expect(terminal!.muted).toBe("transparent")
    expect(terminal!.accent).toBe("blue")
    expect(terminal!.titleFg).toBe("blue")
  })
})
