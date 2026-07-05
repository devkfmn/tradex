import { describe, expect, it } from "vitest";
import { applyFilters, canonicalNames } from "./filters";
import { normalizeMistakes } from "../services/trades";
import type { Trade } from "../types";

function trade(mistakes: string[]): Trade {
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
  };
}

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
