import { describe, expect, test } from "bun:test"
import { buildNavKeys } from "../src/palette"

// Key bytes: arrows are CSI sequences; Ctrl+P=\x10, Ctrl+N=\x0e (emacs),
// Ctrl+K=\x0b, Ctrl+J=\x0a (vim). Values are step deltas (-1 up / +1 down).
describe("buildNavKeys", () => {
  test("default (vim off): arrows + emacs Ctrl+P/Ctrl+N, no Ctrl+J/Ctrl+K", () => {
    const k = buildNavKeys(false)
    expect(k["\x1b[A"]).toBe(-1) // Up arrow
    expect(k["\x1b[B"]).toBe(1) // Down arrow
    expect(k["\x10"]).toBe(-1) // Ctrl+P up
    expect(k["\x0e"]).toBe(1) // Ctrl+N down
    expect(k["\x1b[5~"]).toBe(-10) // PageUp
    expect(k["\x1b[6~"]).toBe(10) // PageDown
    expect(k["\x0b"]).toBeUndefined() // Ctrl+K not bound
    expect(k["\x0a"]).toBeUndefined() // Ctrl+J not bound
  })

  test("vim on: adds Ctrl+K (up) / Ctrl+J (down) on top of the defaults", () => {
    const k = buildNavKeys(true)
    expect(k["\x0b"]).toBe(-1) // Ctrl+K up
    expect(k["\x0a"]).toBe(1) // Ctrl+J down
    // emacs + arrows still present
    expect(k["\x10"]).toBe(-1)
    expect(k["\x0e"]).toBe(1)
    expect(k["\x1b[A"]).toBe(-1)
    expect(k["\x1b[B"]).toBe(1)
  })

  test("returns an isolated map; mutating it can't corrupt later calls", () => {
    const k = buildNavKeys(false)
    k["\x0a"] = 1 // a caller mutating the returned map...
    expect(buildNavKeys(false)["\x0a"]).toBeUndefined() // ...must not leak into the defaults
    expect(buildNavKeys(true)["\x10"]).toBe(-1) // emacs defaults still intact
  })
})
