import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatchToFile } from "../src/dispatch";

function dispatchLine(action: Parameters<typeof dispatchToFile>[0]): string {
  const dir = mkdtempSync(join(tmpdir(), "tmux-palette-test-"));
  const file = join(dir, "cmd");
  try {
    dispatchToFile(action, file);
    return readFileSync(file, "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("dispatchToFile", () => {
  test("encodes tmux commands for the wrapper", () => {
    expect(dispatchLine({ tmux: "split-window -h" })).toBe("tmux:split-window -h");
  });

  test("encodes shell commands for the wrapper", () => {
    expect(dispatchLine({ shell: "echo hi" })).toBe("shell:echo hi");
  });

  test("encodes nested palette actions using the configured launcher", () => {
    const previous = process.env.TMUX_PALETTE_BIN;
    process.env.TMUX_PALETTE_BIN = "/tmp/tmux-palette";
    try {
      expect(dispatchLine({ palette: "themes" })).toBe(
        "tmux:run-shell -b '/tmp/tmux-palette themes'",
      );
    } finally {
      if (previous === undefined) delete process.env.TMUX_PALETTE_BIN;
      else process.env.TMUX_PALETTE_BIN = previous;
    }
  });

  test("encodes popup actions with default sizing", () => {
    expect(dispatchLine({ popup: "htop" })).toStartWith("tmux:display-popup -E -B -s '");
    expect(dispatchLine({ popup: "htop" })).toEndWith(" -h 80% -w 80% htop");
  });
});
