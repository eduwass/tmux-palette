import { definePalette } from "../palette"
import type { PaletteHost } from "../hosts/types"

const originPane = "${PALETTE_ORIGIN_PANE_ID:-$HERDR_PANE_ID}"
const zellijOriginPane = '"$PALETTE_ORIGIN_PANE_ID"'

function herdrCommands() {
  return definePalette({
    title: "Commands",
    items: [
      { icon: "󰍉", category: "Panes", title: "Find Pane",
        action: { palette: "find-pane" } },
      { icon: "", category: "Panes", title: "Split Right", description: "side by side",
        action: { host: `herdr pane split ${originPane} --direction right --focus` } },
      { icon: "", category: "Panes", title: "Split Down", description: "stacked",
        action: { host: `herdr pane split ${originPane} --direction down --focus` } },
      { icon: "󰅖", category: "Panes", title: "Close Pane",
        action: { host: `herdr pane close ${originPane}` } },
      { icon: "󰁔", category: "Panes", title: "Focus Pane Right",
        action: { host: `herdr pane focus --pane ${originPane} --direction right` } },
      { icon: "󰁍", category: "Panes", title: "Focus Pane Left",
        action: { host: `herdr pane focus --pane ${originPane} --direction left` } },
      { icon: "󰍉", category: "Panes", title: "Zoom / Unzoom",
        action: { host: `herdr pane zoom ${originPane} --toggle` } },
      { icon: "󰁁", category: "Panes", title: "Move Pane to...",
        action: { palette: "move-pane" } },

      { icon: "󰝰", category: "Tabs", title: "New Tab",
        action: { host: "herdr tab create --focus" } },
      { icon: "󰁔", category: "Tabs", title: "Choose Pane / Tab",
        action: { palette: "find-pane" } },

      { icon: "󱂬", category: "Workspaces", title: "Choose Workspace",
        action: { palette: "find-pane" } },
      { icon: "󰐕", category: "Workspaces", title: "New Workspace",
        action: { host: "herdr workspace create --focus" } },

      { icon: "", category: "Appearance", title: "Switch Theme...", description: "browse + live-preview bundled themes",
        action: { palette: "themes" } },
    ],
  })
}

function tmuxCommands() {
  return definePalette({
  title: "Commands",
  items: [
    { icon: "󰍉", category: "Panes", title: "Find Pane",
      action: { palette: "find-pane" } },
    { icon: "", category: "Panes", title: "Split Horizontal", description: "side by side",
      action: { host: "split-window -h -c '#{pane_current_path}'" } },
    { icon: "", category: "Panes", title: "Split Vertical", description: "stacked",
      action: { host: "split-window -v -c '#{pane_current_path}'" } },
    { icon: "󰅖", category: "Panes", title: "Close Pane",
      action: { host: "kill-pane" } },
    { icon: "󰒉", category: "Panes", title: "Close Other Panes",
      action: { host: "confirm-before -p 'kill all other panes? (y/n)' 'kill-pane -a'" } },
    { icon: "󰁔", category: "Panes", title: "Next Pane",
      action: { host: "select-pane -t +1" } },
    { icon: "󰁍", category: "Panes", title: "Previous Pane",
      action: { host: "select-pane -t -1" } },
    { icon: "󰎠", category: "Panes", title: "Display Pane Numbers",
      action: { host: "display-panes" } },
    { icon: "󰓡", category: "Panes", title: "Cycle Pane Layout",
      action: { host: "next-layout" } },
    { icon: "󰁝", category: "Panes", title: "Swap Pane Up",
      action: { host: "swap-pane -U" } },
    { icon: "󰁅", category: "Panes", title: "Swap Pane Down",
      action: { host: "swap-pane -D" } },
    { icon: "󰍉", category: "Panes", title: "Zoom / Unzoom",
      action: { host: "resize-pane -Z" } },
    { icon: "󰆏", category: "Panes", title: "Enter Copy Mode", description: "scrollback / select",
      action: { host: "copy-mode" } },
    { icon: "󰏫", category: "Panes", title: "Rename Pane",
      action: { host: "command-prompt -I '#{pane_title}' 'select-pane -T \"%1\"'" } },
    { icon: "󰁁", category: "Panes", title: "Move Pane to...",
      action: { palette: "move-pane" } },
    { icon: "󰘖", category: "Panes", title: "Break to New Window",
      action: { host: "break-pane" } },

    { icon: "󰝰", category: "Windows", title: "New Window",
      action: { host: "new-window -c '#{pane_current_path}'" } },
    { icon: "󰁔", category: "Windows", title: "Next Window",
      action: { host: "next-window" } },
    { icon: "󰁍", category: "Windows", title: "Previous Window",
      action: { host: "previous-window" } },
    { icon: "󰋚", category: "Windows", title: "Last Window",
      action: { host: "last-window" } },
    { icon: "󰏫", category: "Windows", title: "Rename Window",
      action: { host: "command-prompt -I '#W' 'rename-window -- \"%%\"'" } },
    { icon: "󰅖", category: "Windows", title: "Close Window",
      action: { host: "confirm-before -p 'kill window? (y/n)' kill-window" } },

    { icon: "󱂬", category: "Sessions", title: "Choose Session",
      action: { host: "choose-tree -Zs" } },
    { icon: "󰐕", category: "Sessions", title: "New Session",
      action: { host: "command-prompt -p 'New session name:' 'new-session -d -s \"%1\" ; switch-client -t \"%1\"'" } },
    { icon: "󰏫", category: "Sessions", title: "Rename Session",
      action: { host: "command-prompt -I '#S' 'rename-session -- \"%%\"'" } },
    { icon: "󰁔", category: "Sessions", title: "Next Session",
      action: { host: "switch-client -n" } },
    { icon: "󰁍", category: "Sessions", title: "Previous Session",
      action: { host: "switch-client -p" } },
    { icon: "󰍃", category: "Sessions", title: "Detach",
      action: { host: "detach-client" } },
    { icon: "󰆴", category: "Sessions", title: "Kill Session",
      action: { host: "confirm-before -p 'kill session #S? (y/n)' kill-session" } },

    { icon: "󰑓", category: "System", title: "Reload Config",
      action: { host: "source-file ~/.tmux.conf ; display-message 'Config reloaded'" } },

    { icon: "", category: "Appearance", title: "Switch Theme...", description: "browse + live-preview bundled themes",
      action: { palette: "themes" } },
  ],
  })
}

function zellijCommands() {
  return definePalette({
    title: "Commands",
    items: [
      { icon: "󰍉", category: "Panes", title: "Find Pane",
        action: { palette: "find-pane" } },
      { icon: "", category: "Panes", title: "Split Right", description: "side by side",
        action: { host: `zellij action focus-pane-id ${zellijOriginPane}; zellij action new-pane --direction right` } },
      { icon: "", category: "Panes", title: "Split Down", description: "stacked",
        action: { host: `zellij action focus-pane-id ${zellijOriginPane}; zellij action new-pane --direction down` } },
      { icon: "󰅖", category: "Panes", title: "Close Pane",
        action: { host: `zellij action close-pane --pane-id ${zellijOriginPane}` } },
      { icon: "󰁔", category: "Panes", title: "Next Pane",
        action: { host: `zellij action focus-pane-id ${zellijOriginPane}; zellij action focus-next-pane` } },
      { icon: "󰁍", category: "Panes", title: "Previous Pane",
        action: { host: `zellij action focus-pane-id ${zellijOriginPane}; zellij action focus-previous-pane` } },

      { icon: "󰝰", category: "Tabs", title: "New Tab",
        action: { host: "zellij action new-tab" } },
      { icon: "󰁔", category: "Tabs", title: "Choose Pane / Tab",
        action: { palette: "find-pane" } },

      { icon: "", category: "Appearance", title: "Switch Theme...", description: "browse + live-preview bundled themes",
        action: { palette: "themes" } },
    ],
  })
}

export function createCommands(host: PaletteHost) {
  if (host.id === "herdr") return herdrCommands()
  if (host.id === "zellij") return zellijCommands()
  return tmuxCommands()
}

export const commands = tmuxCommands()
