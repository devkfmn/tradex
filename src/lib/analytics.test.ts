import { describe, expect, it } from "vitest";
import {
  computeStats,
  excursionSplitStats,
  excursionStats,
  exitReasonStats,
  expandTradesByMistake,
  maxDrawdown,
  sessionStats,
} from "./analytics";
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
    mistakes: [],
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

  it("excludes break-even trades from win rate", () => {
    const trades = [
      trade("a", "2025-01-01", 2),
      trade("b", "2025-01-02", 1),
      trade("c", "2025-01-03", -1),
      trade("d", "2025-01-04", 0.05),
    ];
    const stats = computeStats(trades);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.breakEvens).toBe(1);
    expect(stats.winRate).toBeCloseTo(2 / 3);
  });

  it("returns null win rate when all trades are break-even", () => {
    const trades = [trade("a", "2025-01-01", 0), trade("b", "2025-01-02", 0.05)];
    const stats = computeStats(trades);
    expect(stats.breakEvens).toBe(2);
    expect(stats.winRate).toBeNull();
  });

  it("returns 100% win rate when there are only wins", () => {
    const stats = computeStats([trade("a", "2025-01-01", 2)]);
    expect(stats.winRate).toBe(1);
  });

  it("returns 0% win rate when there are only losses", () => {
    const stats = computeStats([trade("a", "2025-01-01", -1)]);
    expect(stats.winRate).toBe(0);
  });
});

describe("expandTradesByMistake", () => {
  it("duplicates a trade once per mistake tag", () => {
    const base: Trade = {
      ...trade("a", "2025-01-01", -1),
      mistakes: ["FOMO", "SL too Tight"],
    };
    const expanded = expandTradesByMistake([base]);
    expect(expanded).toHaveLength(2);
    expect(expanded.map((t) => t.mistakes[0])).toEqual(["FOMO", "SL too Tight"]);
    expect(expanded.every((t) => t.realizedR === -1)).toBe(true);
  });

  it("skips trades with no mistakes", () => {
    expect(expandTradesByMistake([trade("a", "2025-01-01", -1)])).toEqual([]);
  });
});

describe("sessionStats", () => {
  it("groups trades by session and always returns 5 rows", () => {
    const trades: Trade[] = [
      { ...trade("a", "2025-01-01", 2), session: "Asia" },
      { ...trade("b", "2025-01-02", -1), session: "London" },
      trade("c", "2025-01-03", -0.5),
    ];
    const stats = sessionStats(trades);
    expect(stats).toHaveLength(5);
    expect(stats.map((s) => s.key)).toEqual([
      "Asia",
      "London",
      "New York",
      "Other",
      "No session",
    ]);
    expect(stats.find((s) => s.key === "Asia")?.count).toBe(1);
    expect(stats.find((s) => s.key === "London")?.count).toBe(1);
    expect(stats.find((s) => s.key === "No session")?.count).toBe(1);
    expect(stats.find((s) => s.key === "New York")?.count).toBe(0);
  });
});

describe("excursionStats", () => {
  it("computes capture ratio and left on table", () => {
    const trades: Trade[] = [
      {
        ...trade("a", "2025-01-01", 1),
        maxFavorableR: 2,
        maxAdverseR: -0.5,
      },
      {
        ...trade("b", "2025-01-02", -1),
        maxFavorableR: 0.5,
        maxAdverseR: -1,
      },
    ];
    const stats = excursionStats(trades);
    expect(stats.countWithMfe).toBe(2);
    expect(stats.countWithMae).toBe(2);
    expect(stats.avgMaxFavorableR).toBeCloseTo(1.25);
    expect(stats.avgMaxAdverseR).toBeCloseTo(-0.75);
    // capture: 1/2 = 0.5, -1/0.5 = -2 => avg -0.75
    expect(stats.captureRatio).toBeCloseTo(-0.75);
    expect(stats.avgLeftOnTable).toBeCloseTo(1); // win only: 2 - 1 = 1
  });

  it("returns null averages when no MFE/MAE data", () => {
    const stats = excursionStats([trade("a", "2025-01-01", 2)]);
    expect(stats.countWithMfe).toBe(0);
    expect(stats.countWithMae).toBe(0);
    expect(stats.avgMaxFavorableR).toBeNull();
    expect(stats.avgMaxAdverseR).toBeNull();
    expect(stats.captureRatio).toBeNull();
    expect(stats.avgLeftOnTable).toBeNull();
  });
});

describe("excursionSplitStats", () => {
  it("splits wins, losses, and break evens", () => {
    const trades: Trade[] = [
      {
        ...trade("a", "2025-01-01", 2),
        maxFavorableR: 3,
        maxAdverseR: -0.5,
      },
      {
        ...trade("b", "2025-01-02", -1),
        maxFavorableR: 0.5,
        maxAdverseR: -1.5,
      },
      {
        ...trade("c", "2025-01-03", 0),
        maxFavorableR: 0.2,
        maxAdverseR: -0.2,
      },
    ];
    const splits = excursionSplitStats(trades);
    expect(splits.map((s) => s.key)).toEqual(["Wins", "Losses", "Break Even"]);
    expect(splits[0].count).toBe(1);
    expect(splits[0].avgRealizedR).toBeCloseTo(2);
    expect(splits[0].avgMaxFavorableR).toBeCloseTo(3);
    expect(splits[1].count).toBe(1);
    expect(splits[1].avgMaxAdverseR).toBeCloseTo(-1.5);
    expect(splits[2].count).toBe(1);
  });
});

describe("exitReasonStats", () => {
  it("groups by exit reason with avg MFE/MAE", () => {
    const trades: Trade[] = [
      {
        ...trade("a", "2025-01-01", 2),
        exitReason: "TP",
        maxFavorableR: 2.5,
        maxAdverseR: -0.3,
      },
      {
        ...trade("b", "2025-01-02", -1),
        exitReason: "SL",
        maxFavorableR: 0.8,
        maxAdverseR: -1,
      },
      {
        ...trade("c", "2025-01-03", 1),
        exitReason: "TP",
        maxFavorableR: 1.5,
        maxAdverseR: -0.5,
      },
    ];
    const stats = exitReasonStats(trades);
    expect(stats).toHaveLength(2);
    const tp = stats.find((s) => s.key === "TP");
    expect(tp?.count).toBe(2);
    expect(tp?.netR).toBeCloseTo(3);
    expect(tp?.avgMaxFavorableR).toBeCloseTo(2);
    const sl = stats.find((s) => s.key === "SL");
    expect(sl?.count).toBe(1);
    expect(sl?.avgMaxAdverseR).toBeCloseTo(-1);
  });

  it("excludes empty groups", () => {
    const stats = exitReasonStats([trade("a", "2025-01-01", 2)]);
    expect(stats).toHaveLength(1);
    expect(stats[0].key).toBe("No exit reason");
  });
});
