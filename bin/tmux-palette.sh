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

# Ask the palette how big it wants to be. cli.ts emits a tab-separated
# triple: rows<TAB>width<TAB>padX, with defaults + sizing.json applied.
# Passing client dims lets sizing.json trigger fullscreen mobile mode.
MEASURE="$(bun "$DIR/src/cli.ts" "$PALETTE" --measure "--cw=$CW" "--ch=$CH" "${EXTRA_ARGS[@]}" 2>/dev/null || echo "20	90	3")"
IFS=$'\t' read -r WANT_H WANT_W WANT_PADX <<< "$MEASURE"
WANT_H="${WANT_H:-20}"
WANT_W="${WANT_W:-90}"
WANT_PADX="${WANT_PADX:-3}"

# Cap by client size, leaving breathing room (mobile mode already
# uses full dims, so the cap is a no-op there).
MAX_H=$(( CH - 2 ))
H=$(( WANT_H > MAX_H ? MAX_H : WANT_H ))
W=$(( WANT_W > CW - 4 ? CW - 4 : WANT_W ))

# Mobile mode wants edge-to-edge: undo the breathing cap.
if [ "$WANT_W" -ge "$CW" ]; then H="$CH"; W="$CW"; fi

# Allow env override.
H="${TMUX_PALETTE_HEIGHT:-$H}"
W="${TMUX_PALETTE_WIDTH:-$W}"

# Build the final argv (palette + any forwarded flags) with shell-safe quoting.
ARG_STR=""
for a in "$PALETTE" "${EXTRA_ARGS[@]}"; do
  ARG_STR+=" $(printf %q "$a")"
done

# TMUX_PALETTE_BIN is set so { palette: "..." } subpalette chaining knows
# how to invoke ourselves — without it we'd assume "tmux-palette" is on PATH.
$TMUX_BIN display-popup -B -w "$W" -h "$H" -E \
  "TMUX_PALETTE_CMD='$CMD_FILE' TMUX_PALETTE_BIN='$0' TMUX_PALETTE_PADX='$WANT_PADX' exec bun '$DIR/src/cli.ts'$ARG_STR"

if [ -s "$CMD_FILE" ]; then
  CMD="$(cat "$CMD_FILE")"
  case "$CMD" in
    tmux:*)
      # Don't propagate the dispatched command's exit status. tmux's `run-shell`
      # surfaces "script returned N" on non-zero exit, and some commands return
      # non-zero even when the prompt itself worked.
      eval "$TMUX_BIN ${CMD#tmux:}" || true
      ;;
    shell:*)
      eval "${CMD#shell:}" || true
      ;;
  esac
fi
exit 0
