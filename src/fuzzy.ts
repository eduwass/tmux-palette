import { autoAlias } from "./text";
import type { Item } from "./types";

const BOUNDARY = /[\s\-_·./:]/;

function exactMatchScore(hs: string, nd: string): number {
  const idx = hs.indexOf(nd);
  if (idx === -1) return 0;
  const atBoundary = idx === 0 || BOUNDARY.test(hs[idx - 1] ?? "");
  return 10000 + (atBoundary ? 5000 : 0) - idx;
}

function charBonus(atBoundary: boolean, consecutive: boolean): number {
  if (atBoundary) return 50;
  if (consecutive) return 20;
  return 5;
}

function subsequenceScore(hs: string, nd: string): number {
  let score = 0;
  let h = 0;
  let prev = -2;
  for (let n = 0; n < nd.length; n++) {
    const target = nd[n];
    while (h < hs.length && hs[h] !== target) h++;
    if (h >= hs.length) return 0;
    const atBoundary = h === 0 || BOUNDARY.test(hs[h - 1] ?? "");
    score += charBonus(atBoundary, h === prev + 1);
    prev = h;
    h++;
  }
  return Math.max(1, score);
}

function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1;
  const hs = haystack.toLowerCase();
  const nd = needle.toLowerCase();
  const exact = exactMatchScore(hs, nd);
  if (exact > 0) return exact;
  return subsequenceScore(hs, nd);
}

export function multiFuzzyScore(haystack: string, parts: string[]): number {
  let total = 0;
  for (const p of parts) {
    const s = fuzzyScore(haystack, p);
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

function buildItemHaystack(item: Item): string {
  const auto = autoAlias(item.title);
  return [item.title, item.description, item.category, item.shortcut, ...(item.aliases ?? []), auto]
    .filter(Boolean)
    .join(" ");
}

// Boost applied when the query exactly matches one of an item's aliases
// (auto-derived initials or user-defined). Has to outrank any fuzzyScore
// the haystack can produce (exact match ≤ 15000) so e.g. "ns" lands on
// "New Session" instead of "Detach" (which incidentally contains "ns"
// inside its "Sessions" category).
const ALIAS_EXACT_BOOST = 100000;

function aliasExactBoost(item: Item, parts: string[]): number {
  if (parts.length !== 1) return 0;
  const q = parts[0]!.toLowerCase();
  const auto = autoAlias(item.title);
  if (auto && auto === q) return ALIAS_EXACT_BOOST;
  for (const a of item.aliases ?? []) {
    if (a.toLowerCase() === q) return ALIAS_EXACT_BOOST;
  }
  return 0;
}

export function defaultFilter(items: Item[], needle: string): Item[] {
  const parts = needle.split(/\s+/).filter(Boolean);
  return items
    .map((c) => ({
      item: c,
      score: multiFuzzyScore(buildItemHaystack(c), parts) + aliasExactBoost(c, parts),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}
