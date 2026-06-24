import { describe, expect, test } from "bun:test";
import { buildNavKeys } from "../src/palette";

describe("buildNavKeys", () => {
  test("keeps Vim keys opt-in", () => {
    const off = buildNavKeys(false);
    expect(off["\x1b[5~"]).toBe(-10);
    expect(off["\x1b[6~"]).toBe(10);
    expect(off["\x0b"]).toBeUndefined();
    expect(off["\x0a"]).toBeUndefined();
    expect(off["\x15"]).toBeUndefined();
    expect(off["\x04"]).toBeUndefined();

    const on = buildNavKeys(true);
    expect(on["\x0b"]).toBe(-1);
    expect(on["\x0a"]).toBe(1);
    expect(on["\x15"]).toBe(-10);
    expect(on["\x04"]).toBe(10);
  });
});
