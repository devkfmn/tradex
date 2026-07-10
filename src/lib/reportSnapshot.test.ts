import { describe, expect, it } from "vitest";
import {
  buildReportSnapshot,
  snapshotCacheKey,
  type BuildReportSnapshotInput,
} from "./reportSnapshot";
import {
  computeStats,
  excursionSplitStats,
  excursionStats,
  exitReasonStats,
  groupStats,
  sessionStats,
  weekdayStats,
} from "./analytics";
import { emptyFilters } from "./filters";
import type { Trade } from "../types";

function trade(
  id: string,
  date: string,
  realizedR: number,
  overrides: Partial<Trade> = {}
): Trade {
  return {
    id,
    date,
    coin: "BTC",
    direction: "Long",
    setup: "Breakout",
    riskPct: null,
    riskUsd: null,
    pnl: null,
    realizedR,
    grade: "",
    mistakes: [],
    postNotes: "",
    screenshotUrls: [],
    ...overrides,
  };
}

function baseInput(trades: Trade[]): BuildReportSnapshotInput {
  const filtered = trades;
  const overall = computeStats(filtered);
  const longStats = computeStats(filtered.filter((t) => t.direction === "Long"));
  const shortStats = computeStats(filtered.filter((t) => t.direction === "Short"));
  return {
    rangeLabel: "Last 90 days",
    from: "2025-04-01",
    to: "2025-06-30",
    tradeCount: filtered.length,
    filters: emptyFilters,
    trades: filtered,
    overall,
    longStats,
    shortStats,
    setupStats: groupStats(filtered, (t) => t.setup, { emptyLabel: "No setup" }),
    mistakeStats: groupStats(filtered, (t) => t.mistakes[0] ?? "none"),
    coinStats: groupStats(filtered, (t) => t.coin),
    sessions: sessionStats(filtered),
    weekdays: weekdayStats(filtered),
    excursions: excursionStats(filtered),
    excursionSplits: excursionSplitStats(filtered),
    exitReasons: exitReasonStats(filtered),
  };
}

describe("buildReportSnapshot", () => {
  it("includes range label and trade count", () => {
    const trades = [
      trade("a", "2025-05-01", 2),
      trade("b", "2025-05-02", -1),
      trade("c", "2025-05-03", 1.5),
    ];
    const snapshot = buildReportSnapshot(baseInput(trades));
    expect(snapshot.rangeLabel).toBe("Last 90 days");
    expect(snapshot.tradeCount).toBe(3);
  });

  it("includes setup best and worst trade R", () => {
    const trades = [
      trade("a", "2025-05-01", 2, { setup: "A" }),
      trade("b", "2025-05-02", 3, { setup: "A" }),
    ];
    const snapshot = buildReportSnapshot(baseInput(trades));
    expect(snapshot.setups[0].bestTradeR).toBe(3);
    expect(snapshot.setups[0].worstTradeR).toBe(2);
  });

  it("includes grade and market condition breakdowns", () => {
    const trades = [
      trade("a", "2025-05-01", 2, { grade: "A", marketCondition: "Trend" }),
      trade("b", "2025-05-02", -1, { grade: "C", marketCondition: "Chop" }),
    ];
    const snapshot = buildReportSnapshot(baseInput(trades));
    expect(snapshot.grades.some((g) => g.name === "A")).toBe(true);
    expect(snapshot.marketConditions.some((g) => g.name === "Trend")).toBe(true);
  });

  it("includes planned R vs actual when plannedR is logged", () => {
    const trades = [
      trade("a", "2025-05-01", 1.5, { plannedR: 2 }),
      trade("b", "2025-05-02", -1, { plannedR: -1 }),
    ];
    const snapshot = buildReportSnapshot(baseInput(trades));
    expect(snapshot.plannedR?.countWithPlan).toBe(2);
    expect(snapshot.plannedR?.avgPlannedR).toBe(0.5);
  });

  it("always includes excursion block with data coverage", () => {
    const snapshot = buildReportSnapshot(baseInput([trade("a", "2025-05-01", 1)]));
    expect(snapshot.excursions.dataCoverage.totalTrades).toBe(1);
    expect(snapshot.excursions.dataCoverage.missingBoth).toBe(1);
    expect(snapshot.excursions.portfolio).toBeNull();
  });

  it("includes rich excursion detail when MFE/MAE present", () => {
    const trades = [
      trade("a", "2025-05-01", 2, { maxFavorableR: 3, maxAdverseR: -0.5, plannedR: 2 }),
      trade("b", "2025-05-02", -1, { maxFavorableR: 1.2, maxAdverseR: -1.5 }),
    ];
    const snapshot = buildReportSnapshot(baseInput(trades));
    expect(snapshot.excursions.portfolio).not.toBeNull();
    expect(snapshot.excursions.winners).not.toBeNull();
    expect(snapshot.excursions.losers?.countWentGreenBeforeLoss).toBe(1);
    expect(snapshot.excursions.byOutcome).toHaveLength(3);
  });
});

describe("snapshotCacheKey", () => {
  it("changes when range label changes", () => {
    const trades = [trade("a", "2025-05-01", 1), trade("b", "2025-05-02", 1), trade("c", "2025-05-03", 1)];
    const inputA = baseInput(trades);
    const inputB = { ...baseInput(trades), rangeLabel: "Last 30 days" };
    expect(snapshotCacheKey(buildReportSnapshot(inputA))).not.toBe(
      snapshotCacheKey(buildReportSnapshot(inputB))
    );
  });
});
