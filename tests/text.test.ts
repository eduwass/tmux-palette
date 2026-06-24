import { describe, expect, test } from "bun:test";
import { autoAlias, charWidth, displayWidth, truncate } from "../src/text";

describe("display width", () => {
  test("counts ASCII and wide glyphs", () => {
    expect(charWidth("a")).toBe(1);
    expect(charWidth("😀")).toBe(2);
    expect(displayWidth("a😀b")).toBe(4);
  });

  test("ignores ANSI color escapes", () => {
    expect(displayWidth("\x1b[31mred\x1b[0m")).toBe(3);
  });
});

describe("truncate", () => {
  test("pads short strings to the requested display width", () => {
    expect(truncate("tmux", 6)).toBe("tmux  ");
  });

  test("truncates long strings with an ellipsis", () => {
    expect(truncate("tmux-palette", 6)).toBe("tmux-…");
  });

  test("does not split a wide glyph across the boundary", () => {
    expect(truncate("ab😀cd", 5)).toBe("ab😀…");
  });
});

describe("autoAlias", () => {
  test("builds initials from multi-word titles", () => {
    expect(autoAlias("Split Horizontal")).toBe("sh");
  });

  test("ignores single-word titles", () => {
    expect(autoAlias("Detach")).toBeNull();
  });
});
