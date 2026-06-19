import { describe, expect, test } from "bun:test"
import { commands } from "../src/palettes/commands"

function items() {
  return Array.isArray(commands.items) ? commands.items : []
}

function hostCommandOf(title: string): string {
  const it = items().find((i) => i.title === title)
  if (!it) throw new Error(`no item titled ${title}`)
  if ("host" in it.action) return it.action.host
  if ("tmux" in it.action) return it.action.tmux
  throw new Error(`item ${title} has no host action`)
}

function hostCommand(action: ReturnType<typeof items>[number]["action"]): string | null {
  if ("host" in action) return action.host
  if ("tmux" in action) return action.tmux
  return null
}

describe("commands palette", () => {
  test("New Session creates and switches to the new session", () => {
    const cmd = hostCommandOf("New Session")
    expect(cmd).toContain("new-session")
    expect(cmd).toContain("switch-client")
  })

  // `%%` is substituted only on the FIRST occurrence; reusing it silently
  // leaves later occurrences literal. Use `%1` when the response is needed
  // more than once in the template.
  test("no tmux command-prompt template reuses %% (use %1 instead)", () => {
    const offenders: string[] = []
    for (const it of items()) {
      const cmd = hostCommand(it.action)
      if (!cmd) continue
      if (!cmd.includes("command-prompt")) continue
      const count = (cmd.match(/%%/g) ?? []).length
      if (count > 1) offenders.push(`${it.title}: ${cmd}`)
    }
    expect(offenders).toEqual([])
  })
})
