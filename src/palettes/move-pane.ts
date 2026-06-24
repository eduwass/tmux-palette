import { definePalette } from "../palette";
import { tmux, tmuxQuote } from "../tmux";
import type { Item } from "../types";

function newWindowItems(sessions: string[], paneId: string): Item[] {
  return sessions.map((session) => ({
    icon: "󰝰",
    title: "New window",
    description: `in ${session}`,
    action: { tmux: `break-pane -d -s ${tmuxQuote(paneId)} -t ${tmuxQuote(`${session}:`)}` },
  }));
}

type WindowLine = { session: string; windowIndex: string; windowName: string };

function parseWindowLine(line: string): WindowLine | null {
  const [session, windowIndex, windowName] = line.split("\t");
  if (!session || !windowIndex) return null;
  return { session, windowIndex, windowName: windowName || `window${windowIndex}` };
}

function joinWindowItems(winLines: string[], paneId: string, currentWindow: string): Item[] {
  const items: Item[] = [];
  for (const line of winLines) {
    const w = parseWindowLine(line);
    if (!w) continue;
    const target = `${w.session}:${w.windowIndex}`;
    if (target === currentWindow) continue;
    items.push({
      icon: "󰖲",
      title: w.windowName,
      description: `${w.session} · ${w.windowIndex}`,
      action: { tmux: `join-pane -d -s ${tmuxQuote(paneId)} -t ${tmuxQuote(target)}` },
    });
  }
  return items;
}

export const movePane = definePalette({
  title: "Move Pane to...",
  grouped: false,
  emptyText: "No targets",
  items: () => {
    const paneId = tmux(["display-message", "-p", "#{pane_id}"]);
    const currentWindow = tmux(["display-message", "-p", "#{session_name}:#{window_index}"]);
    const sessions = tmux(["list-sessions", "-F", "#S"]).split("\n").filter(Boolean);
    const winLines = tmux([
      "list-windows",
      "-a",
      "-F",
      "#{session_name}\t#{window_index}\t#{window_name}",
    ])
      .split("\n")
      .filter(Boolean);

    return [
      ...newWindowItems(sessions, paneId),
      ...joinWindowItems(winLines, paneId, currentWindow),
    ];
  },
});
