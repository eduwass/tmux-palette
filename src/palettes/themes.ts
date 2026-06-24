import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { definePalette } from "../palette";
import { invalidateThemeCache, listThemes } from "../theme";
import type { Item, Theme } from "../types";

const CONFIG_FILE = `${process.env.XDG_CONFIG_HOME ?? `${process.env.HOME ?? ""}/.config`}/tmux-palette/theme.json`;
const CUSTOM_THEME_DOCS = "https://github.com/eduwass/tmux-palette#custom-themes";

function saveTheme(slug: string): void {
  mkdirSync(dirname(CONFIG_FILE), { recursive: true });
  writeFileSync(CONFIG_FILE, `${JSON.stringify({ name: slug }, null, 2)}\n`);
  invalidateThemeCache();
}

function buildItems(): Item[] {
  return [
    ...listThemes().map((t) => ({
      icon: "●",
      iconColor: t.theme.accent,
      title: t.name,
      description: t.source === "user" ? "custom" : undefined,
      data: t.theme,
      aliases: [t.slug],
      action: { apply: () => saveTheme(t.slug) },
    })),
    {
      icon: "+",
      title: "Add custom theme...",
      description: "Open setup instructions",
      aliases: ["custom", "theme", "docs"],
      action: { shell: `open '${CUSTOM_THEME_DOCS}' || xdg-open '${CUSTOM_THEME_DOCS}'` },
    },
  ];
}

export const themes = definePalette({
  title: "Themes",
  grouped: false,
  items: buildItems,
  emptyText: "No themes found",
  onSelect: (item) => (item?.data as Theme | undefined) ?? undefined,
});
