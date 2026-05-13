# tmux-palette

A Raycast-style command palette for tmux. Runs on [Bun](https://bun.sh),
zero runtime dependencies, snappy enough to feel like a native widget
(~30ms cold start).

Type a few letters, pick a command, hit enter — split a pane, jump to a window,
detach a session, whatever. Designed to be easy to extend with your own
palettes.

https://github.com/user-attachments/assets/3a8f3951-619f-46b4-a180-b9a03ccb8593

## Install

<details>
<summary><b>Hand off to an AI agent</b> (recommended — auto-detects your terminal theme)</summary>

<br/>

Paste the prompt below into [Claude Code](https://claude.com/claude-code), [Codex](https://github.com/openai/codex), [opencode](https://opencode.ai), Cursor, or any AI coding agent. It will install the repo, set up your tmux binding, and (optionally) match the palette colors to your terminal theme.

````
You are helping a user install tmux-palette — a Raycast-style command palette for tmux. Repo: https://github.com/eduwass/tmux-palette

Follow steps in order. Confirm with the user before any change that modifies their files.

1. Prerequisites
- Run `bun --version`. If Bun is missing, point them to https://bun.sh/docs/installation and stop — do not auto-install.
- Run `tmux -V`. If lower than 3.4, warn that `display-popup -E` may not work, then proceed.

2. Clone and install
- Default path: `~/Sites/tmux-palette`. Ask the user if they want a different location.
- If the path already exists and contains the repo, run `git -C <path> pull` and skip cloning.
- Otherwise: `git clone https://github.com/eduwass/tmux-palette <path> && cd <path> && bun install`.

3. Bind it to a tmux key (required — the palette doesn't open without one)
- Default suggestion: `bind -n C-Space run-shell "<absolute-path>/bin/tmux-palette.sh"` (no-prefix, opens with Ctrl+Space — Raycast-feel). Ask the user if they want a different key.
- Append the bind line to `~/.tmux.conf` (create it if missing).
- Run `tmux source-file ~/.tmux.conf` to reload (or tell them to do it).

4. Match the palette to their terminal theme (optional)
Ask: "Want the palette colors to match your terminal's theme?"

If yes, detect their terminal:
- Check $TERM_PROGRAM and $TERM. Common values: ghostty, iTerm.app, vscode, WezTerm, Apple_Terminal.
- Read the relevant config:
  - Ghostty:    ~/.config/ghostty/config
  - Alacritty:  ~/.config/alacritty/alacritty.toml (or .yml)
  - Kitty:      ~/.config/kitty/kitty.conf  (follow `include` lines)
  - WezTerm:    ~/.wezterm.lua or ~/.config/wezterm/wezterm.lua
  - iTerm2 / others: ask the user for hex codes; their configs are hard to parse.
- Extract: background → `bg`, foreground → `fg`, cursor color → `accent`, selection bg → `selected`. Derive `panel` (slightly lighter than bg) and `muted` (fg dimmed).
- Write `~/.config/tmux-palette/theme.json` with `{ bg, panel, selected, fg, muted, accent }`. The palette reads this at runtime; do NOT edit source files.
- Report the colors you picked.

5. Test
Tell the user to press their binding. Ask what they see.

6. Offer follow-ups
When it works, ask:
- "Want to change the binding?" — revisit step 3.
- "Want to add custom commands?" — write items to `~/.config/tmux-palette/commands.json` (array of Items). Action types: `{ "tmux": "..." }`, `{ "shell": "..." }`, `{ "palette": "name" }`. Do NOT edit source files.
- "Want custom shortcut labels?" — write `~/.config/tmux-palette/shortcuts.json` mapping item titles to label strings (useful when the user's binding is at the terminal layer and tmux can't see it).
- "Want to explore the sub-palettes?" — they already have Find Pane and Move Pane to... in the default palette.

Constraints
- Prefer `~/.config/tmux-palette/*.json` over source edits. The user's config survives upstream pulls; source edits don't.
- Do not push to git or modify files outside the user's home directory.
- Do not auto-install Bun or any other system package.
- If anything fails, stop and explain what went wrong.
````

</details>

<details>
<summary><b>Manual install</b></summary>

<br/>

```bash
git clone https://github.com/eduwass/tmux-palette ~/Sites/tmux-palette
cd ~/Sites/tmux-palette
bun install
```

Bind it to a tmux key in your `.tmux.conf` — `Ctrl+Space` gives the most "Raycast-feel" since it skips the prefix:

```tmux
bind -n C-Space run-shell "~/Sites/tmux-palette/bin/tmux-palette.sh"
```

Or if you'd rather go through the tmux prefix:

```tmux
bind p run-shell "~/Sites/tmux-palette/bin/tmux-palette.sh"
```

Reload: `tmux source-file ~/.tmux.conf` and hit your binding.

</details>

<details>
<summary><b>Install via TPM</b> (Tmux Plugin Manager)</summary>

<br/>

Requires Bun: https://bun.sh

Add to your `.tmux.conf`:

```tmux
set -g @plugin 'eduwass/tmux-palette'
set -g @palette-key 'C-Space'             # optional, default: C-Space (no-prefix)
set -g @palette-find-pane-key 'M-f'       # optional, no binding by default
set -g @palette-move-pane-key 'M-m'       # optional, no binding by default
```

Then `prefix + I` to install. TPM clones the repo, runs `bun install` on first load, and binds the keys for you. Set `@palette-key 'off'` to skip the main binding and bind it yourself.

</details>

## Usage

- **Type** to filter. Multi-word search is supported (`split horiz`).
- **Up/Down arrows** or **Ctrl+P / Ctrl+N** to move selection.
- **Enter** to run the selected command.
- **Esc** to cancel.
- **Mouse** works too — click rows, scroll the wheel.

### Auto-aliases

Initials of multi-word titles are matched automatically. Type `nw` for "New
Window", `cs` for "Choose Session", `sh` for "Split Horizontal", etc. These
aren't displayed in the UI — they just work.

### Category hotkeys

Pass `--category=<name>` to open a palette filtered to just one category.
Useful for binding "my Tools" or "my Appearance" to a single keystroke,
Raycast-favorites style:

```tmux
bind -n M-t run-shell "~/Sites/tmux-palette/bin/tmux-palette.sh commands --category=Tools"
bind -n M-a run-shell "~/Sites/tmux-palette/bin/tmux-palette.sh commands --category=Appearance"
```

The popup title auto-updates to the category name and the category
header gets hidden (since everything is the same category anyway).

## Customize

Drop-in user config lives in `~/.config/tmux-palette/`. Edit JSON files here
to add commands, custom shortcut labels, theme overrides, or extra alias
chips — no source edits, no fork, survives upstream pulls.

### `shortcuts.json` — custom shortcut labels

When your terminal has a key-remap layer (Ghostty / iTerm2 / Karabiner) that
translates something like `Cmd+D` into a tmux binding, tmux only sees the
tmux side and doesn't know the original key. Use this to show what you
actually press:

```json
{
  "Split Horizontal": "Cmd+D",
  "Find Pane": "Cmd+Shift+P",
  "Choose Session": "Cmd+S"
}
```

Keys are item titles; values are whatever text you want on the right side.

### `commands.json` — your own items

Append items to the `commands` palette without editing source. Same shape
as items in `src/palettes/commands.ts`:

```json
[
  {
    "icon": "",
    "title": "Toggle Diff Viewer",
    "category": "Tools",
    "action": { "tmux": "run-shell '/path/to/script.sh'" }
  },
  {
    "icon": "󱂬",
    "title": "Open Project in Cursor",
    "category": "Tools",
    "action": { "shell": "cursor /path/to/project" }
  }
]
```

Action types: `{ "tmux": "..." }`, `{ "shell": "..." }`, `{ "palette": "find-pane" }`.

### `aliases.json` — extra visible alias chips

```json
{
  "Split Horizontal": ["sh"],
  "Find Pane": ["fp"]
}
```

Auto-aliases (initials like `nw`) still work for free, invisibly.

### `theme.json` — color overrides

```json
{
  "bg": "#1a1b26",
  "panel": "#16161e",
  "selected": "#283457",
  "fg": "#c0caf5",
  "muted": "#565f89",
  "accent": "#7aa2f7"
}
```

Applies to all palettes. Built-in themes (`shades-of-purple` default,
`dracula`, `tokyo-night`, `minimal`) live in `src/theme.ts`.

### `sizing.json` — popup dimensions

```json
{
  "maxHeight": 28,
  "width": 90,
  "padX": 3,
  "mobileWidth": 80
}
```

All keys optional. Defaults shown. `maxHeight` caps how tall the popup
gets when you have lots of commands. `width` is the fixed popup width.
`padX` is the horizontal padding inside the popup.

`mobileWidth` is the client-width threshold for auto-fullscreen mode:
when the terminal is narrower than this many columns (iOS terminals
like Blink or Moshi typically run 50-60 cols), the popup goes
edge-to-edge with `padX=1` so it doesn't waste any screen real estate.
Defaults to 80, set to 0 to disable.

## Extending (deeper)

For things JSON can't express — custom palettes, custom row rendering,
dynamic item generators — edit the TS source. Items in
`src/palettes/commands.ts` have this shape:

```ts
{
  icon: "󰍉",              // any nerd-font glyph
  title: "Find Pane",
  description?: "...",    // optional, dimmed text after title
  shortcut?: "Cmd+Shift+P", // optional, right-aligned label
  category?: "Panes",     // optional, groups items under a header
  aliases?: ["fp"],       // optional, visible chip + searchable
  action: { tmux: "..." } // see Actions below
}
```

### Actions

```ts
{ tmux: "split-window -h" }     // runs `tmux <cmd>` after the popup closes
{ shell: "echo hi" }            // runs a shell command after the popup closes
{ palette: "find-pane" }        // chains into another palette
{ run: (ctx) => { ... } }       // custom JS, runs in-process
```

`{ tmux }` is special: it dispatches *after* the popup closes, so interactive
tmux prompts (`confirm-before`, `command-prompt`) actually get keyboard
input. Without this, prompts hang because the popup still owns stdin.

## How it works (the trick)

The bash wrapper opens a `tmux display-popup` running the palette. When you
pick an item, the palette writes the encoded command to a tempfile and exits.
The wrapper *then* reads the tempfile and runs the command — *after* the
popup is gone. This matters because interactive tmux commands like
`confirm-before` need stdin, which is captured by the popup while it's open.

## License

MIT
