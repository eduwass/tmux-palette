#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PALETTE="${1:-commands}"
shift || true
EXTRA_ARGS=("$@")

ORIGIN_PANE="$(zellij action list-panes --json --all | bun -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const panes=JSON.parse(s);const p=panes.find(p=>p.is_focused)||panes.find(p=>p.is_selectable!==false&&!p.is_suppressed);if(!p)return;process.stdout.write(`${p.is_plugin?"plugin":"terminal"}_${p.id}`);})')"

ARG_STR=""
for a in "$PALETTE" "${EXTRA_ARGS[@]}"; do
  ARG_STR+=" $(printf %q "$a")"
done

W="${PALETTE_WIDTH:-80%}"
H="${PALETTE_HEIGHT:-70%}"
ORIGIN_Q="$(printf %q "$ORIGIN_PANE")"

zellij action new-pane \
  --floating \
  --close-on-exit \
  --width "$W" \
  --height "$H" \
  --name "command palette" \
  -- bash -lc "PALETTE_HOST=zellij PALETTE_ORIGIN_PANE_ID=$ORIGIN_Q exec bun '$DIR/src/cli.ts'$ARG_STR" \
  >/dev/null
