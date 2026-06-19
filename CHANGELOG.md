# Changelog

## Unreleased

- Add a host abstraction with tmux and Herdr adapters.
- Add neutral `{ "host": "..." }` actions, `host:` dispatch lines, `PALETTE_*` env vars, and `~/.config/command-palette/` config lookup while keeping tmux compatibility fallbacks.
- Add a Herdr-native commands palette and pane/move-pane data sources for `PALETTE_HOST=herdr`.

## v0.3.0 - 2026-06-12

- New bundled "Terminal" theme: transparent backgrounds and terminal-native ANSI colors, so the palette follows your terminal's own color scheme. Pick it via Switch Theme... or `{ "name": "terminal" }` in `theme.json`.
- Theme color fields now accept `transparent` (the terminal default) and named ANSI colors (`blue`, `bright-black`, etc.) alongside hex, in any built-in, `theme.json`, or custom theme.
- New optional theme fields: `selectedFg` (active-row highlight) and `titleFg` (header title color).

## v0.2.1 - 2026-05-14

- Fix: typing an auto-alias (e.g. `ns` for "New Session") now ranks the aliased item first instead of getting outranked by items that just happen to contain the query inside their category (e.g. "Detach" matching via "Sessio**ns**").

## v0.2.0 - 2026-05-14

- Filter input now has a visible blinking caret, tinted with the active theme's accent (and retinted live as you scroll the theme picker).
- Cursor movement in the filter: Left/Right, Home/End (Ctrl+A/E), plus Alt+Left/Right and Ctrl+Left/Right for word jumps.
- Editing shortcuts in the filter: Backspace, Delete, Alt+Backspace/Ctrl+W for word-delete, Ctrl+U to kill-to-start, Ctrl+K to kill-to-end.
- Text selection with Shift + any of the cursor-movement keys (char, word, line ends). Typing replaces the selection; Backspace/Delete remove it; Esc clears it. Rendered with the theme's selected colors.
- README: noted beta status and contribution scope while the basics stabilize.

## v0.1.1 - 2026-05-13

- Fix: New Session command now switches you to the new session (was silently creating it in the background and leaving you on the current one).
- Fix: Wrapper script works on macOS's bash 3.2.
- Find Pane: cursor starts on the current pane; other panes render muted so the current one reads as the visual anchor.

## v0.1.0 - 2026-05-13

Initial public release.

- Command palette for tmux panes, windows, sessions, and config reloads.
- Nested palettes for finding panes, moving panes, and switching themes.
- Custom user config under `~/.config/tmux-palette/`.
- Custom commands via `commands.json` and hidden built-ins via `hidden.json`.
- Custom palettes from JSON files, built-in items, categories, or shell commands.
- Plugin-style command sources that emit JSON or one item per line.
- Popup actions for terminal tools like `htop`, `btop`, `lazygit`, logs, and `fzf` scripts.
- Curated built-in themes with live preview and support for custom themes.
- Mobile/narrow-terminal fullscreen mode and configurable popup sizing/borders.
- TPM and manual install paths, plus optional guided onboarding prompt.
- Example palettes for GitHub PRs, GitHub Actions, git branches, Docker logs, npm scripts, and file picking.
- CI coverage for Bun tests, TypeScript, Fallow dead-code, and Fallow duplication checks.
