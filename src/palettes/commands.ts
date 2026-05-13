import { definePalette } from "../palette"
import { getRecent } from "../recents"
import type { Item } from "../types"

function recentItems(staticItems: Item[]): Item[] {
  const byTitle = new Map(staticItems.map((i) => [i.title, i]))
  const out: Item[] = []
  for (const title of getRecent()) {
    const found = byTitle.get(title)
    if (!found) continue
    out.push({ ...found, category: "Recent", showWhen: "no-filter" })
  }
  return out
}

const staticItems: Item[] = [
    { icon: "󰍉", category: "Panes", title: "Find Pane",
      action: { palette: "find-pane" } },
    { icon: "", category: "Panes", title: "Split Horizontal", description: "side by side",
      action: { tmux: "split-window -h -c '#{pane_current_path}'" } },
    { icon: "", category: "Panes", title: "Split Vertical", description: "stacked",
      action: { tmux: "split-window -v -c '#{pane_current_path}'" } },
    { icon: "󰅖", category: "Panes", title: "Close Pane",
      action: { tmux: "kill-pane" } },
    { icon: "󰒉", category: "Panes", title: "Close Other Panes",
      action: { tmux: "confirm-before -p 'kill all other panes? (y/n)' 'kill-pane -a'" } },
    { icon: "󰁔", category: "Panes", title: "Next Pane",
      action: { tmux: "select-pane -t +1" } },
    { icon: "󰁍", category: "Panes", title: "Previous Pane",
      action: { tmux: "select-pane -t -1" } },
    { icon: "󰎠", category: "Panes", title: "Display Pane Numbers",
      action: { tmux: "display-panes" } },
    { icon: "󰓡", category: "Panes", title: "Cycle Pane Layout",
      action: { tmux: "next-layout" } },
    { icon: "󰁝", category: "Panes", title: "Swap Pane Up",
      action: { tmux: "swap-pane -U" } },
    { icon: "󰁅", category: "Panes", title: "Swap Pane Down",
      action: { tmux: "swap-pane -D" } },
    { icon: "󰍉", category: "Panes", title: "Zoom / Unzoom",
      action: { tmux: "resize-pane -Z" } },
    { icon: "󰆏", category: "Panes", title: "Enter Copy Mode", description: "scrollback / select",
      action: { tmux: "copy-mode" } },
    { icon: "󰏫", category: "Panes", title: "Rename Pane",
      action: { tmux: "command-prompt -I '#{pane_title}' 'select-pane -T \"%1\"'" } },
    { icon: "󰁁", category: "Panes", title: "Move Pane to...",
      action: { palette: "move-pane" } },
    { icon: "󰘖", category: "Panes", title: "Break to New Window",
      action: { tmux: "break-pane" } },

    { icon: "󰝰", category: "Windows", title: "New Window",
      action: { tmux: "new-window -c '#{pane_current_path}'" } },
    { icon: "󰁔", category: "Windows", title: "Next Window",
      action: { tmux: "next-window" } },
    { icon: "󰁍", category: "Windows", title: "Previous Window",
      action: { tmux: "previous-window" } },
    { icon: "󰋚", category: "Windows", title: "Last Window",
      action: { tmux: "last-window" } },
    { icon: "󰏫", category: "Windows", title: "Rename Window",
      action: { tmux: "command-prompt -I '#W' 'rename-window -- \"%%\"'" } },
    { icon: "󰅖", category: "Windows", title: "Close Window",
      action: { tmux: "confirm-before -p 'kill window? (y/n)' kill-window" } },

    { icon: "󱂬", category: "Sessions", title: "Choose Session",
      action: { tmux: "choose-tree -Zs" } },
    { icon: "󰐕", category: "Sessions", title: "New Session",
      action: { tmux: "command-prompt 'new-session -s \"%%\"'" } },
    { icon: "󰏫", category: "Sessions", title: "Rename Session",
      action: { tmux: "command-prompt -I '#S' 'rename-session -- \"%%\"'" } },
    { icon: "󰁔", category: "Sessions", title: "Next Session",
      action: { tmux: "switch-client -n" } },
    { icon: "󰁍", category: "Sessions", title: "Previous Session",
      action: { tmux: "switch-client -p" } },
    { icon: "󰍃", category: "Sessions", title: "Detach",
      action: { tmux: "detach-client" } },
    { icon: "󰆴", category: "Sessions", title: "Kill Session",
      action: { tmux: "confirm-before -p 'kill session #S? (y/n)' kill-session" } },

    { icon: "󰑓", category: "System", title: "Reload Config",
      action: { tmux: "source-file ~/.tmux.conf ; display-message 'Config reloaded'" } },

    { icon: "", category: "Appearance", title: "Switch Theme...", description: "browse + live-preview bundled themes",
      action: { palette: "themes" } },
]

export const commands = definePalette({
  title: "Commands",
  items: () => [
    ...recentItems(staticItems),
    ...staticItems,
  ],
})
