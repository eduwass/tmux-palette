#!/usr/bin/env bash
set -euo pipefail

TMUX_BIN="$(command -v tmux)"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
CMD_FILE="$(mktemp)"
trap 'rm -f "$CMD_FILE"' EXIT

PALETTE="${1:-commands}"
shift || true
# Remaining args (e.g. --category=Tools) get forwarded to both the
# measure pass and the popup invocation so filters affect sizing too.
EXTRA_ARGS=("$@")

CH="$($TMUX_BIN display-message -p '#{client_height}' 2>/dev/null || echo 24)"
CW="$($TMUX_BIN display-message -p '#{client_width}' 2>/dev/null || echo 80)"

# Ask the palette how big it wants to be. cli.ts emits tab-separated
# rows<TAB>width<TAB>padX<TAB>border<TAB>bodyStyle<TAB>borderStyle,
# with defaults + sizing.json applied. Passing client dims lets
# sizing.json trigger fullscreen mobile mode.
MEASURE="$(bun "$DIR/src/cli.ts" "$PALETTE" --measure "--cw=$CW" "--ch=$CH" ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"} 2>/dev/null || echo "20	90	3	none	default	default")"
IFS=$'\t' read -r WANT_H WANT_W WANT_PADX WANT_BORDER WANT_BODY_STYLE WANT_BORDER_STYLE <<< "$MEASURE"
WANT_H="${WANT_H:-20}"
WANT_W="${WANT_W:-90}"
WANT_PADX="${WANT_PADX:-3}"
WANT_BORDER="${WANT_BORDER:-none}"
WANT_BODY_STYLE="${WANT_BODY_STYLE:-default}"
WANT_BORDER_STYLE="${WANT_BORDER_STYLE:-default}"

# Cap by client size, leaving breathing room (mobile mode already
# uses full dims, so the cap is a no-op there).
MAX_H=$(( CH - 2 ))
H=$(( WANT_H > MAX_H ? MAX_H : WANT_H ))
W=$(( WANT_W > CW - 4 ? CW - 4 : WANT_W ))

# Mobile mode wants edge-to-edge: undo the breathing cap.
if [ "$WANT_W" -ge "$CW" ]; then H="$CH"; W="$CW"; fi

# Allow env override.
H="${PALETTE_HEIGHT:-${TMUX_PALETTE_HEIGHT:-$H}}"
W="${PALETTE_WIDTH:-${TMUX_PALETTE_WIDTH:-$W}}"

# Border: "none" maps to tmux's -B (no border). Anything else is passed
# through tmux's -b <type>: single, double, heavy, rounded, padded, simple.
# -s sets the popup body style, -S the border style — both match the
# palette theme by default so the chrome doesn't read as stock tmux.
BORDER_ARGS=(-B -s "$WANT_BODY_STYLE")
if [ "$WANT_BORDER" != "none" ]; then
  BORDER_ARGS=(-b "$WANT_BORDER" -s "$WANT_BODY_STYLE" -S "$WANT_BORDER_STYLE")
fi

# Build the final argv (palette + any forwarded flags) with shell-safe quoting.
ARG_STR=""
for a in "$PALETTE" ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}; do
  ARG_STR+=" $(printf %q "$a")"
done

# BORDERED=1 tells the palette to skip its own top/bottom pad rows
# (the tmux border replaces them visually, otherwise it looks double-padded).
BORDERED=0
[ "$WANT_BORDER" != "none" ] && BORDERED=1

# PALETTE_BIN is set so { palette: "..." } subpalette chaining knows
# how to invoke ourselves — without it we'd assume "tmux-palette" is on PATH.
$TMUX_BIN display-popup "${BORDER_ARGS[@]}" -w "$W" -h "$H" -E \
  "PALETTE_CMD='$CMD_FILE' PALETTE_BIN='$0' PALETTE_PADX='$WANT_PADX' PALETTE_BORDERED='$BORDERED' TMUX_PALETTE_CMD='$CMD_FILE' TMUX_PALETTE_BIN='$0' TMUX_PALETTE_PADX='$WANT_PADX' TMUX_PALETTE_BORDERED='$BORDERED' exec bun '$DIR/src/cli.ts'$ARG_STR"

if [ -s "$CMD_FILE" ]; then
  CMD="$(cat "$CMD_FILE")"
  case "$CMD" in
    host:*)
      # Don't propagate the dispatched command's exit status. tmux's `run-shell`
      # surfaces "script returned N" on non-zero exit, and some commands return
      # non-zero even when the prompt itself worked.
      eval "$TMUX_BIN ${CMD#host:}" || true
      ;;
    tmux:*)
      # Legacy prefix accepted for existing user configs / older palette builds.
      eval "$TMUX_BIN ${CMD#tmux:}" || true
      ;;
    shell:*)
      eval "${CMD#shell:}" || true
      ;;
  esac
fi
exit 0
