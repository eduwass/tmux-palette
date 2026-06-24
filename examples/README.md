# Example palettes

Drop-in palettes that turn common CLI tools into tmux-palette popups.
Each file is a complete custom palette — copy it to your config,
bind a key, done.

```bash
cp examples/git-branches.json ~/.config/tmux-palette/palettes/
```

```tmux
# in ~/.tmux.conf
bind -n M-b run-shell "~/Sites/tmux-palette/bin/tmux-palette.sh git-branches"
```

Reload (`tmux source-file ~/.tmux.conf`), hit your binding, you're done.

## What's here

| File                                               | What it does                                                                             | Needs                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------- |
| [`git-branches.json`](git-branches.json)           | List local branches, click to `git checkout` in the current pane                         | `git`                                   |
| [`github-prs.json`](github-prs.json)               | List open/draft/merged/closed PRs with color-coded status dots, click to open in browser | `gh` (authed)                           |
| [`docker-containers.json`](docker-containers.json) | List running containers, click to tail logs in a popup                                   | `docker`                                |
| [`npm-scripts.json`](npm-scripts.json)             | List scripts from the current dir's `package.json`, click to run                         | `jq`, `npm`, a `package.json` in `$PWD` |
| [`find-files.json`](find-files.json)               | List files in the current dir tree, click to open in `$EDITOR`                           | `find`, `$EDITOR` set                   |

## How these work

Every example uses the same trick — a single `command` field that pipes
some CLI's output into the palette. Two output modes:

- **Plain text** (most of these) — one item per line, `action` template
  at the palette level with `{}` substituted for the selected line
- **JSON** (`github-prs.json`) — the command emits a full Item array,
  per-item icons and colors

See the main [Plugins](../README.md#plugins) section for the full spec.

## Contributing

If you write a useful one, open a PR. Things that'd land easily:

- `kubectl get pods` / `get deployments` with color-coded status
- `aws ecs list-tasks` or similar
- A `fly logs <app>` launcher
- Recent files via `fd` or `rg --files`
- `lazygit` / `lazydocker` / other TUIs via `{ popup }`
- Cloudflare Workers, Vercel deployments, Linear issues
