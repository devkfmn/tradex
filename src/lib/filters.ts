import type { Trade } from "../types";
import { resultFromR } from "./analytics";
import { format, startOfMonth, subDays } from "date-fns";

export interface TradeFilters {
  search: string;
  from: string;
  to: string;
  coin: string;
  direction: string;
  setup: string;
  grade: string;
  mistake: string;
  result: string;
}

export const emptyFilters: TradeFilters = {
  search: "",
  from: "",
  to: "",
  coin: "",
  direction: "",
  setup: "",
  grade: "",
  mistake: "",
  result: "",
};

export type DatePreset = "all" | "30d" | "90d" | "month" | "custom";

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "All time",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  month: "This month",
  custom: "Custom",
};

export function presetToDateRange(preset: DatePreset): { from: string; to: string } {
  const today = format(new Date(), "yyyy-MM-dd");
  if (preset === "all") return { from: "", to: "" };
  if (preset === "30d") return { from: format(subDays(new Date(), 29), "yyyy-MM-dd"), to: today };
  if (preset === "90d") return { from: format(subDays(new Date(), 89), "yyyy-MM-dd"), to: today };
  if (preset === "month") {
    return { from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: today };
  }
  return { from: "", to: "" };
}

export function filterTradesByDateRange(
  trades: Trade[],
  from: string,
  to: string
): Trade[] {
  return trades.filter((t) => {
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    return true;
  });
}

export function applyFilters(trades: Trade[], f: TradeFilters): Trade[] {
  const search = f.search.trim().toLowerCase();
  return trades.filter((t) => {
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (f.coin && t.coin !== f.coin) return false;
    if (f.direction && t.direction !== f.direction) return false;
    if (f.setup && t.setup !== f.setup) return false;
    if (f.grade && t.grade !== f.grade) return false;
    if (f.mistake && !t.mistakes.includes(f.mistake)) return false;
    if (f.result) {
      const r = resultFromR(t.realizedR);
      if (r !== f.result) return false;
    }
    if (search) {
      const hay = [t.coin, t.setup, ...t.mistakes, t.postNotes, t.thesis]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

export function uniqueSorted(values: (string | undefined | null)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (v && v.trim()) set.add(v.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Resolve a free-text label to the canonical library name (case-insensitive). */
export function canonicalName(
  value: string,
  library: { name: string }[]
): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = library.find(
    (item) => item.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  return match?.name ?? trimmed;
}

/** Resolve and dedupe multiple labels to canonical library names. */
export function canonicalNames(
  values: string[],
  library: { name: string }[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const name = canonicalName(value, library);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
