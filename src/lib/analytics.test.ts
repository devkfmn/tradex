import { describe, expect, it } from "vitest";
import { computeStats, maxDrawdown } from "./analytics";
import type { Trade } from "../types";

function trade(id: string, date: string, realizedR: number): Trade {
  return {
    id,
    date,
    coin: "BTC",
    direction: "Long",
    setup: "",
    riskPct: null,
    riskUsd: null,
    pnl: null,
    realizedR,
    grade: "",
    mistake: "",
    postNotes: "",
    screenshotUrls: [],
  };
}

describe("maxDrawdown", () => {
  it("uses chronological order, not input order", () => {
    // Wrong order: +2 then -3 (drawdown 3)
    const wrongOrder = maxDrawdown([2, -3]);
    // Chronological: -3 on day 1, +2 on day 2 (drawdown 3 from 0)
    const chronological = maxDrawdown([-3, 2]);
    expect(wrongOrder).toBe(3);
    expect(chronological).toBe(3);

    // Order matters when peak is in the middle
    const outOfOrder = maxDrawdown([3, -2, -2]); // peak 3, trough -1 => dd 4
    const byDate = maxDrawdown([-2, 3, -2]); // cum: -2, 1, -1 => dd 3
    expect(outOfOrder).not.toBe(byDate);
  });
});

describe("computeStats", () => {
  it("sorts by trade date before computing max drawdown", () => {
    const trades = [
      trade("b", "2025-02-02", 3),
      trade("a", "2025-02-01", -2),
      trade("c", "2025-02-03", -2),
    ];
    const stats = computeStats(trades);
    // Chronological: -2, +3, -2 => peak 1, trough -1 => max dd 2
    expect(stats.maxDrawdown).toBe(2);
  });
});
