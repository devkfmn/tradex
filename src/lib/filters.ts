import type { Trade } from "../types";
import { resultFromR } from "./analytics";

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

export function applyFilters(trades: Trade[], f: TradeFilters): Trade[] {
  const search = f.search.trim().toLowerCase();
  return trades.filter((t) => {
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (f.coin && t.coin !== f.coin) return false;
    if (f.direction && t.direction !== f.direction) return false;
    if (f.setup && t.setup !== f.setup) return false;
    if (f.grade && t.grade !== f.grade) return false;
    if (f.mistake && t.mistake !== f.mistake) return false;
    if (f.result) {
      const r = resultFromR(t.realizedR);
      if (r !== f.result) return false;
    }
    if (search) {
      const hay = [t.coin, t.setup, t.mistake, t.postNotes, t.thesis]
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
