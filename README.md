# tmux-palette

A command palette for tmux. It runs on [Bun](https://bun.sh), has no runtime
dependencies, and opens quickly enough to use as a regular tmux binding.

Type a few letters, pick a command, hit enter: split a pane, jump to a window,
detach a session, open a popup tool, or switch to a custom palette. User config
lives in `~/.config/tmux-palette/*.json`, so local changes survive repo updates.

## Highlights

- **Fast startup** — designed for frequent use from a tmux key binding
- **Custom palettes** — define your own with [a single JSON file](#custom-palettes-configtmux-palettepalettesnamejson), bind to any key
- **Hide built-ins** — declutter the default palette via [`hidden.json`](#hiddenjson--hide-built-in-items)
- **Mobile-aware** — [auto-fullscreens](#sizingjson--popup-dimensions-and-borders) on narrow terminals (Moshi / Blink on iOS)
- **Curated themes** — 12 built-in themes including Shades of Purple, Dracula, Tokyo Night, Catppuccin, Gruvbox, Nord, and Solarized. [Pick one with live preview](#themes), or [drop your own](#custom-themes)
- **Popup tools** — use `{ "popup": "htop" }` to open tools like `btop`, `lazygit`, log tails, or `fzf` scripts in a tmux popup
- **Scriptable sources** — point a palette at a shell command that prints JSON or one item per line. Examples live in [`examples/`](examples)
- **Small codebase** — roughly 2k LOC, so it is easy to audit, fork, or patch locally
- **No fork required** — every customization lives in `~/.config/tmux-palette/*.json`

## Install

<details>
<summary><b>Hand off to an AI agent</b> (auto-detects your terminal theme)</summary>

<br/>

Paste the prompt below into [Claude Code](https://claude.com/claude-code), [Codex](https://github.com/openai/codex), [opencode](https://opencode.ai), Cursor, or any AI coding agent. It will install the repo, set up your tmux binding, and (optionally) match the palette colors to your terminal theme.

````
You are helping a user install tmux-palette, a command palette for tmux. Repo: https://github.com/eduwass/tmux-palette

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
- "Want to add custom commands?" — write items to `~/.config/tmux-palette/commands.json` (array of Items). Action types: `{ "tmux": "..." }`, `{ "shell": "..." }`, `{ "popup": "..." }`, `{ "palette": "name" }`. Do NOT edit source files.
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

## Usage

- **Type** to filter. Multi-word search is supported (`split horiz`).
- **Up/Down arrows** or **Ctrl+P / Ctrl+N** to move selection.
- **Enter** to run the selected command.
- **Esc** to cancel.
- **Mouse** works too — click rows, scroll the wheel.

**Auto-aliases**: initials of multi-word titles match automatically. Type `nw` for "New
Window", `cs` for "Choose Session", `sh` for "Split Horizontal", etc.

## Customize

Drop-in user config lives in `~/.config/tmux-palette/`. One JSON file per
concern — no source edits, no fork, survives upstream pulls.

### Custom palettes (`~/.config/tmux-palette/palettes/<name>.json`)

Define a brand-new palette and bind any key to its name:

```tmux
bind -n M-q run-shell "~/Sites/tmux-palette/bin/tmux-palette.sh my-favs"
```

```jsonc
// ~/.config/tmux-palette/palettes/my-favs.json
{
  "title": "Favorites",
  "from": ["Toggle Diff Viewer", "Find Pane", "Choose Session"],
  "fromCategory": "Tools",
  "items": [
    {
      "icon": "",
      "title": "Custom item only in this palette",
      "action": { "tmux": "run-shell '~/scripts/x.sh'" }
    }
  ]
}
```

- `from` — array of item titles to pull from the main commands palette (built-ins + your `commands.json`)
- `fromCategory` — pull every item from one category
- `command` — shell command that prints a JSON array of `Item` objects to stdout (see [plugins](#plugins) below)
- `items` — brand-new items defined inline
- `title` / `grouped` / `emptyText` — same as built-in palettes

All keys optional. Resolution order: `from` → `fromCategory` → `command` → `items`.

#### Plugins

> Drop-in ready-to-use palettes live in [`examples/`](examples) — git branches,
> GitHub PRs (with color-coded status dots), Docker container logs,
> npm scripts, file picker. Copy one and bind a key.

The `command` field is the plugin escape hatch — fzf-style. Anything
that prints to stdout becomes a palette. Two output modes:

**JSON mode** — full control. Print a JSON array of `Item` objects:

```jsonc
// ~/.config/tmux-palette/palettes/github-prs.json
{
  "title": "GitHub PRs",
  "command": "gh pr list --json number,title,url --jq '[.[] | {icon: \"\", title: ((.number|tostring) + \" \" + .title), action: {shell: (\"gh pr view \" + (.number|tostring) + \" --web\")}}]'"
}
```

**Plain-text mode** — fzf-style. Print one item per line, define a
default `action` template at the palette level with `{}` substituted
for the selected line:

```jsonc
// ~/.config/tmux-palette/palettes/git-branches.json
{
  "title": "Git Branches",
  "command": "git branch --format='%(refname:short)'",
  "action": { "tmux": "send-keys 'git checkout {}' Enter" }
}
```

This means most "command that prints lines" tools you'd pipe through
fzf can become tmux-palette palettes with no scripting — just the JSON
config and an action template.

Write the command in any language, distribute it however you want
(gist, repo, copy-paste). The plugin runs every time the palette opens
(no caching), so for expensive calls add your own cache layer. Errors
are surfaced as a single item in the palette so failures stay visible
without crashing the popup.

### `hidden.json` — hide built-in items

Drop a JSON array of item titles to skip them in the main commands
palette:

```json
["Toggle Status Bar", "Reload Config", "Toggle OpenTUI Top Bar"]
```

Items still appear if you reference them by title in a custom palette
(see above) — `hidden.json` is just about decluttering the default.

### `commands.json` — your own items

Append items to the `commands` palette without editing source:

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
  },
  {
    "icon": "",
    "title": "htop",
    "category": "Tools",
    "action": { "popup": "htop" }
  }
]
```

Action types: `{ "tmux": "..." }`, `{ "shell": "..." }`, `{ "popup": "..." }`, `{ "palette": "find-pane" }`.

`{ "popup": "htop" }` opens the given command in a centered tmux popup
(80% × 80%, closes when the command exits). Handy for log viewers,
htop, btop, less, fzf-driven tools, etc.

### `sizing.json` — popup dimensions and borders

```json
{
  "maxHeight": 28,
  "width": 90,
  "padX": 3,
  "mobileWidth": 80,
  "border": "none",
  "popupBorder": "none"
}
```

All keys optional. `maxHeight` caps how tall the popup gets when you
have lots of commands. `width` is the fixed popup width. `padX` is the
horizontal padding inside the popup.

`mobileWidth` is the client-width threshold for auto-fullscreen mode:
when the terminal is narrower than this many columns (iOS terminals
like Blink or Moshi typically run 50-60 cols), the popup goes
edge-to-edge with `padX=1`. Defaults to 80, set to 0 to disable.

`border` is the main palette border, `popupBorder` is the border for
`{ "popup": "..." }` action popups. Both default to `none`. Accepted
values: `none`, `single`, `double`, `heavy`, `rounded`, `padded`,
`simple` — passed straight to `tmux display-popup -b`. `rounded` works
but its corner glyphs can leave small visual gaps against the
surrounding terminal, so it is not the default.

### Themes

Open the main palette and pick **Switch Theme...** (under *Appearance*).
Arrow-key through the list — every theme lives-previews instantly so you
see the colors apply before you commit. Enter saves it and returns you to
the previous palette with the new theme on; Esc cancels.

The theme picker also includes **Add custom theme...**, which opens this
README's custom-theme instructions in your default browser.

Bundled themes are intentionally limited to a small curated set: Shades of
Purple, Dracula, Tokyo Night, Catppuccin Mocha, Gruvbox Dark, Rosé Pine, Nord,
Solarized Dark, Kanagawa Wave, GitHub Dark, One Dark, and Ayu Dark. Their
panel/selected/muted/accent colors are tuned for readable contrast. To tweak a
theme without editing the repo, add a custom theme file or override individual
colors in `theme.json`.

### `theme.json` — set the active theme

Two forms. Pick a bundled (or custom) theme by name:

```json
{ "name": "tokyo-night" }
```

Or full color override (applied on top of the resolved theme):

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

The theme switcher writes the `{ "name": "..." }` form for you. You can
also mix: pick a name, then add individual keys to nudge specific colors.

### Custom themes

Drop one JSON file per theme into `~/.config/tmux-palette/themes/`:

```jsonc
// ~/.config/tmux-palette/themes/my-theme.json
{
  "bg": "#0d0f12",
  "panel": "#171a1f",
  "selected": "#2c3038",
  "fg": "#e6e8eb",
  "muted": "#7d8590",
  "accent": "#ff6b6b"
}
```

Custom themes show up in the **Switch Theme...** picker alongside the
bundled ones (tagged `custom`). The filename becomes the slug — drop
`my-theme.json` → reference it as `{ "name": "my-theme" }` in
`theme.json`, or just pick it from the switcher.

### Category hotkeys

Pass `--category=<name>` to open the main palette filtered to one
category, Raycast-favorites style:

```tmux
bind -n M-t run-shell "~/Sites/tmux-palette/bin/tmux-palette.sh commands --category=Tools"
bind -n M-a run-shell "~/Sites/tmux-palette/bin/tmux-palette.sh commands --category=Appearance"
```

The popup title auto-updates to the category name and the category
header gets hidden (since everything is the same category anyway).

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

### `aliases.json` — extra visible alias chips

```json
{
  "Split Horizontal": ["sh"],
  "Find Pane": ["fp"]
}
```

Auto-aliases (initials like `nw`) still work for free, invisibly.

## Extending (deeper)

For things JSON can't express — custom row rendering, dynamic item
generators, custom filter logic — edit the TS source. Items in
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
{ popup: "htop" }               // opens cmd in a centered 80% tmux popup
{ palette: "find-pane" }        // chains into another palette
{ run: (ctx) => { ... } }       // custom JS, runs in-process, then exits
{ apply: (ctx) => { ... } }     // custom JS, runs in-process, then pops
                                // back to the previous palette (used by
                                // the theme switcher to "apply + return")
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
