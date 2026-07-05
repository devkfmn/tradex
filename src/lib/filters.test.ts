import { describe, expect, it } from "vitest";
import { applyFilters, canonicalNames, compareTradesByRecency } from "./filters";
import { normalizeMistakes } from "../services/trades";
import type { Trade } from "../types";

function trade(mistakes: string[], overrides: Partial<Trade> = {}): Trade {
  return {
    id: "1",
    date: "2025-01-01",
    coin: "BTC",
    direction: "Long",
    setup: "Breakout",
    riskPct: null,
    riskUsd: null,
    pnl: null,
    realizedR: -1,
    grade: "",
    mistakes,
    postNotes: "",
    screenshotUrls: [],
    ...overrides,
  };
}

describe("compareTradesByRecency", () => {
  it("orders same-day trades by createdAt descending", () => {
    const older = trade([], { id: "a", createdAt: 100 });
    const newer = trade([], { id: "b", createdAt: 200 });
    expect(compareTradesByRecency(older, newer)).toBeGreaterThan(0);
    expect(compareTradesByRecency(newer, older)).toBeLessThan(0);
  });

  it("orders by date before createdAt", () => {
    const laterDay = trade([], { id: "a", date: "2025-01-02", createdAt: 50 });
    const earlierDay = trade([], { id: "b", date: "2025-01-01", createdAt: 500 });
    expect(compareTradesByRecency(earlierDay, laterDay)).toBeGreaterThan(0);
  });

  it("sorts newest first when used with desc default", () => {
    const trades = [
      trade([], { id: "a", date: "2025-01-01", createdAt: 100 }),
      trade([], { id: "b", date: "2025-01-02", createdAt: 50 }),
      trade([], { id: "c", date: "2025-01-01", createdAt: 200 }),
    ];
    const sorted = [...trades].sort((a, b) => compareTradesByRecency(a, b));
    expect(sorted.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });
});

describe("normalizeMistakes", () => {
  it("reads mistakes array from Firestore data", () => {
    expect(
      normalizeMistakes({ mistakes: ["FOMO", "  SL too Tight ", "FOMO"] })
    ).toEqual(["FOMO", "SL too Tight"]);
  });

  it("falls back to legacy mistake string", () => {
    expect(normalizeMistakes({ mistake: "Chased" })).toEqual(["Chased"]);
  });

  it("returns empty array when no mistakes", () => {
    expect(normalizeMistakes({})).toEqual([]);
  });
});

describe("applyFilters mistake filter", () => {
  it("matches trades that include the selected mistake", () => {
    const trades = [
      trade(["FOMO", "SL too Tight"]),
      trade(["Early exit"]),
      trade([]),
    ];
    const filtered = applyFilters(trades, {
      search: "",
      from: "",
      to: "",
      coin: "",
      direction: "",
      setup: "",
      grade: "",
      mistake: "FOMO",
      result: "",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].mistakes).toContain("FOMO");
  });
});

describe("canonicalNames", () => {
  it("dedupes case-insensitive labels", () => {
    expect(
      canonicalNames(["fomo", "FOMO", "Chased"], [{ name: "FOMO" }])
    ).toEqual(["FOMO", "Chased"]);
  });
});
