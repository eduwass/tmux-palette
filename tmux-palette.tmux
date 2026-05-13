#!/usr/bin/env bash
# TPM entry point for tmux-palette.
# Sourced by tmux when the plugin is installed via tmux-plugins/tpm.

set -eu

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v bun >/dev/null 2>&1; then
  tmux display-message "tmux-palette: bun not found. Install Bun first: https://bun.sh"
  exit 0
fi

if [ ! -d "$CURRENT_DIR/node_modules" ]; then
  (cd "$CURRENT_DIR" && bun install --silent) >/dev/null 2>&1 || {
    tmux display-message "tmux-palette: 'bun install' failed in $CURRENT_DIR"
    exit 0
  }
fi

get_opt() {
  local val
  val="$(tmux show-option -gqv "$1" 2>/dev/null || true)"
  echo "${val:-$2}"
}

PALETTE_KEY="$(get_opt @palette-key 'C-Space')"
FIND_PANE_KEY="$(get_opt @palette-find-pane-key '')"
MOVE_PANE_KEY="$(get_opt @palette-move-pane-key '')"

if [ "$PALETTE_KEY" != "off" ] && [ -n "$PALETTE_KEY" ]; then
  tmux bind-key -n "$PALETTE_KEY" run-shell "$CURRENT_DIR/bin/tmux-palette.sh"
fi

if [ -n "$FIND_PANE_KEY" ]; then
  tmux bind-key -n "$FIND_PANE_KEY" run-shell "$CURRENT_DIR/bin/tmux-palette.sh find-pane"
fi

if [ -n "$MOVE_PANE_KEY" ]; then
  tmux bind-key -n "$MOVE_PANE_KEY" run-shell "$CURRENT_DIR/bin/tmux-palette.sh move-pane"
fi
