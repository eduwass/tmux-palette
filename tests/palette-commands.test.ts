import { describe, expect, test } from "bun:test";
import { commands } from "../src/palettes/commands";

function items() {
  return Array.isArray(commands.items) ? commands.items : [];
}

function tmuxOf(title: string): string {
  const it = items().find((i) => i.title === title);
  if (!it) throw new Error(`no item titled ${title}`);
  if (!("tmux" in it.action)) throw new Error(`item ${title} has no tmux action`);
  return it.action.tmux;
}

describe("commands palette", () => {
  test("New Session creates and switches to the new session", () => {
    const cmd = tmuxOf("New Session");
    expect(cmd).toContain("new-session");
    expect(cmd).toContain("switch-client");
  });

  // `%%` is substituted only on the FIRST occurrence; reusing it silently
  // leaves later occurrences literal. Use `%1` when the response is needed
  // more than once in the template.
  test("no tmux command-prompt template reuses %% (use %1 instead)", () => {
    const offenders: string[] = [];
    for (const it of items()) {
      if (!("tmux" in it.action)) continue;
      const cmd = it.action.tmux;
      if (!cmd.includes("command-prompt")) continue;
      const count = (cmd.match(/%%/g) ?? []).length;
      if (count > 1) offenders.push(`${it.title}: ${cmd}`);
    }
    expect(offenders).toEqual([]);
  });
});
