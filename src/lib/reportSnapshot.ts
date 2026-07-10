import type { Trade } from "../types";
import type {
  ExcursionSplit,
  ExcursionStats,
  ExitReasonStat,
  GroupStat,
  Stats,
} from "./analytics";
import { groupStats } from "./analytics";
import type { TradeFilters } from "./filters";

export interface SnapshotGroup {
  name: string;
  count: number;
  netR: number;
  netPnl: number | null;
  winRate: number | null;
  expectancy: number | null;
  profitFactor: number | null;
  bestTradeR: number | null;
  worstTradeR: number | null;
}

export interface SnapshotOverall {
  netR: number;
  netPnl: number | null;
  winRate: number | null;
  expectancy: number | null;
  profitFactor: number | null;
  maxDrawdown: number;
  avgWinR: number | null;
  avgLossR: number | null;
  wins: number;
  losses: number;
  breakEvens: number;
}

export interface SnapshotLongVsShort {
  long: SnapshotGroup;
  short: SnapshotGroup;
  strongerSide: "Long" | "Short" | "Even" | null;
}

export interface SnapshotExcursionSplit {
  outcome: ExcursionSplit["key"];
  count: number;
  avgRealizedR: number | null;
  avgMaxFavorableR: number | null;
  avgMaxAdverseR: number | null;
}

export interface SnapshotExcursionWinners {
  count: number;
  avgRealizedR: number | null;
  avgMaxFavorableR: number | null;
  avgCaptureRatio: number | null;
  avgLeftOnTableR: number | null;
}

export interface SnapshotExcursionLosers {
  count: number;
  avgRealizedR: number | null;
  avgMaxAdverseR: number | null;
  avgMaxFavorableR: number | null;
  /** Losses that went at least +0.5R in favor before closing red */
  countWentGreenBeforeLoss: number;
}

export interface SnapshotExcursions {
  dataCoverage: {
    totalTrades: number;
    withMaxFavorableR: number;
    withMaxAdverseR: number;
    missingBoth: number;
  };
  portfolio: {
    avgMaxFavorableR: number | null;
    avgMaxAdverseR: number | null;
    captureRatio: number | null;
    avgLeftOnTable: number | null;
  } | null;
  byOutcome: SnapshotExcursionSplit[];
  winners: SnapshotExcursionWinners | null;
  losers: SnapshotExcursionLosers | null;
}

export interface SnapshotExitReason extends SnapshotGroup {
  avgMaxFavorableR: number | null;
  avgMaxAdverseR: number | null;
}

export interface SnapshotPlannedR {
  countWithPlan: number;
  avgPlannedR: number | null;
  avgRealizedR: number | null;
  avgPlanVsActualDelta: number | null;
  winnersAvgDelta: number | null;
  losersAvgDelta: number | null;
}

export interface ReportSnapshot {
  rangeLabel: string;
  from: string;
  to: string;
  tradeCount: number;
  activeFilters: Record<string, string>;
  overall: SnapshotOverall;
  longVsShort: SnapshotLongVsShort;
  setups: SnapshotGroup[];
  mistakes: SnapshotGroup[];
  coins: SnapshotGroup[];
  sessions: SnapshotGroup[];
  weekdays: SnapshotGroup[];
  grades: SnapshotGroup[];
  marketConditions: SnapshotGroup[];
  timeframes: SnapshotGroup[];
  plannedR: SnapshotPlannedR | null;
  excursions: SnapshotExcursions;
  exitReasons: SnapshotExitReason[];
}

export interface BuildReportSnapshotInput {
  rangeLabel: string;
  from: string;
  to: string;
  tradeCount: number;
  filters: TradeFilters;
  trades: Trade[];
  overall: Stats;
  longStats: Stats;
  shortStats: Stats;
  setupStats: GroupStat[];
  mistakeStats: GroupStat[];
  coinStats: GroupStat[];
  sessions: GroupStat[];
  weekdays: GroupStat[];
  excursions: ExcursionStats;
  excursionSplits: ExcursionSplit[];
  exitReasons: ExitReasonStat[];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return sum(nums) / nums.length;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function toSnapshotGroup(g: GroupStat): SnapshotGroup {
  return {
    name: g.key,
    count: g.count,
    netR: round(g.netR),
    netPnl: g.hasPnl ? round(g.netPnl) : null,
    winRate: g.winRate,
    expectancy: g.expectancy == null ? null : round(g.expectancy),
    profitFactor: g.profitFactor,
    bestTradeR: g.bestTradeR == null ? null : round(g.bestTradeR),
    worstTradeR: g.worstTradeR == null ? null : round(g.worstTradeR),
  };
}

function toOverall(stats: Stats): SnapshotOverall {
  return {
    netR: round(stats.netR),
    netPnl: stats.hasPnl ? round(stats.netPnl) : null,
    winRate: stats.winRate,
    expectancy: stats.expectancy == null ? null : round(stats.expectancy),
    profitFactor: stats.profitFactor,
    maxDrawdown: round(stats.maxDrawdown),
    avgWinR: stats.avgWinR == null ? null : round(stats.avgWinR),
    avgLossR: stats.avgLossR == null ? null : round(stats.avgLossR),
    wins: stats.wins,
    losses: stats.losses,
    breakEvens: stats.breakEvens,
  };
}

function directionGroup(stats: Stats, label: "Long" | "Short"): SnapshotGroup {
  return {
    name: label,
    count: stats.count,
    netR: round(stats.netR),
    netPnl: stats.hasPnl ? round(stats.netPnl) : null,
    winRate: stats.winRate,
    expectancy: stats.expectancy == null ? null : round(stats.expectancy),
    profitFactor: stats.profitFactor,
    bestTradeR: null,
    worstTradeR: null,
  };
}

function strongerSide(longNetR: number, shortNetR: number): SnapshotLongVsShort["strongerSide"] {
  if (longNetR === shortNetR) return "Even";
  return longNetR > shortNetR ? "Long" : "Short";
}

function sortByNetRDesc(groups: GroupStat[]): SnapshotGroup[] {
  return [...groups]
    .filter((g) => g.count > 0)
    .sort((a, b) => b.netR - a.netR)
    .map(toSnapshotGroup);
}

function sortByNetRAsc(groups: GroupStat[]): SnapshotGroup[] {
  return [...groups]
    .filter((g) => g.count > 0)
    .sort((a, b) => a.netR - b.netR)
    .map(toSnapshotGroup);
}

function activeFiltersFrom(filters: TradeFilters): Record<string, string> {
  const out: Record<string, string> = {};
  const keys: (keyof TradeFilters)[] = [
    "coin",
    "direction",
    "setup",
    "grade",
    "mistake",
    "result",
  ];
  for (const key of keys) {
    const val = filters[key]?.trim();
    if (val) out[key] = val;
  }
  return out;
}

function plannedRInsights(trades: Trade[]): SnapshotPlannedR | null {
  const rows = trades.filter(
    (t) =>
      t.plannedR != null &&
      t.realizedR != null &&
      Number.isFinite(t.plannedR) &&
      Number.isFinite(t.realizedR)
  );
  if (rows.length === 0) return null;

  const deltas = rows.map((t) => (t.realizedR as number) - (t.plannedR as number));
  const wins = rows.filter((t) => (t.realizedR as number) > 0.1);
  const losses = rows.filter((t) => (t.realizedR as number) < -0.1);

  return {
    countWithPlan: rows.length,
    avgPlannedR: round(avg(rows.map((t) => t.plannedR as number)) ?? 0),
    avgRealizedR: round(avg(rows.map((t) => t.realizedR as number)) ?? 0),
    avgPlanVsActualDelta: round(avg(deltas) ?? 0),
    winnersAvgDelta:
      wins.length > 0
        ? round(
            avg(
              wins.map((t) => (t.realizedR as number) - (t.plannedR as number))
            ) ?? 0
          )
        : null,
    losersAvgDelta:
      losses.length > 0
        ? round(
            avg(
              losses.map((t) => (t.realizedR as number) - (t.plannedR as number))
            ) ?? 0
          )
        : null,
  };
}

function buildExcursions(
  trades: Trade[],
  stats: ExcursionStats,
  splits: ExcursionSplit[]
): SnapshotExcursions {
  const missingBoth = trades.filter(
    (t) =>
      (t.maxFavorableR == null || !Number.isFinite(t.maxFavorableR)) &&
      (t.maxAdverseR == null || !Number.isFinite(t.maxAdverseR))
  ).length;

  const wins = trades.filter((t) => t.realizedR != null && t.realizedR > 0.1);
  const losses = trades.filter((t) => t.realizedR != null && t.realizedR < -0.1);

  const winCaptureTrades = wins.filter(
    (t) =>
      t.maxFavorableR != null &&
      Number.isFinite(t.maxFavorableR) &&
      t.maxFavorableR > 0.1 &&
      t.realizedR != null
  );
  const captureRatios = winCaptureTrades.map(
    (t) => (t.realizedR as number) / (t.maxFavorableR as number)
  );
  const leftOnTable = winCaptureTrades.map(
    (t) => (t.maxFavorableR as number) - (t.realizedR as number)
  );

  const lossesWithMfe = losses.filter(
    (t) => t.maxFavorableR != null && Number.isFinite(t.maxFavorableR)
  );
  const wentGreenBeforeLoss = lossesWithMfe.filter((t) => (t.maxFavorableR as number) > 0.5);

  const hasPortfolio = stats.countWithMfe > 0 || stats.countWithMae > 0;

  return {
    dataCoverage: {
      totalTrades: trades.length,
      withMaxFavorableR: stats.countWithMfe,
      withMaxAdverseR: stats.countWithMae,
      missingBoth,
    },
    portfolio: hasPortfolio
      ? {
          avgMaxFavorableR: stats.avgMaxFavorableR,
          avgMaxAdverseR: stats.avgMaxAdverseR,
          captureRatio: stats.captureRatio,
          avgLeftOnTable: stats.avgLeftOnTable,
        }
      : null,
    byOutcome: splits.map((row) => ({
      outcome: row.key,
      count: row.count,
      avgRealizedR: row.avgRealizedR,
      avgMaxFavorableR: row.avgMaxFavorableR,
      avgMaxAdverseR: row.avgMaxAdverseR,
    })),
    winners:
      wins.length > 0
        ? {
            count: wins.length,
            avgRealizedR: avg(wins.map((t) => t.realizedR as number)),
            avgMaxFavorableR: avg(
              wins
                .map((t) => t.maxFavorableR)
                .filter((v): v is number => v != null && Number.isFinite(v))
            ),
            avgCaptureRatio: avg(captureRatios),
            avgLeftOnTableR: avg(leftOnTable),
          }
        : null,
    losers:
      losses.length > 0
        ? {
            count: losses.length,
            avgRealizedR: avg(losses.map((t) => t.realizedR as number)),
            avgMaxAdverseR: avg(
              losses
                .map((t) => t.maxAdverseR)
                .filter((v): v is number => v != null && Number.isFinite(v))
            ),
            avgMaxFavorableR: avg(
              lossesWithMfe.map((t) => t.maxFavorableR as number)
            ),
            countWentGreenBeforeLoss: wentGreenBeforeLoss.length,
          }
        : null,
  };
}

function toExitReasons(groups: ExitReasonStat[]): SnapshotExitReason[] {
  return groups
    .filter((g) => g.count > 0)
    .sort((a, b) => b.netR - a.netR)
    .map((g) => ({
      ...toSnapshotGroup(g),
      avgMaxFavorableR: g.avgMaxFavorableR,
      avgMaxAdverseR: g.avgMaxAdverseR,
    }));
}

/** Build a JSON snapshot of all report metrics for AI summary generation. */
export function buildReportSnapshot(input: BuildReportSnapshotInput): ReportSnapshot {
  const long = directionGroup(input.longStats, "Long");
  const short = directionGroup(input.shortStats, "Short");
  const { trades } = input;

  return {
    rangeLabel: input.rangeLabel,
    from: input.from,
    to: input.to,
    tradeCount: input.tradeCount,
    activeFilters: activeFiltersFrom(input.filters),
    overall: toOverall(input.overall),
    longVsShort: {
      long,
      short,
      strongerSide: strongerSide(long.netR, short.netR),
    },
    setups: sortByNetRDesc(input.setupStats),
    mistakes: sortByNetRAsc(input.mistakeStats),
    coins: sortByNetRDesc(input.coinStats),
    sessions: sortByNetRDesc(input.sessions),
    weekdays: sortByNetRDesc(input.weekdays),
    grades: sortByNetRDesc(
      groupStats(trades, (t) => t.grade, { emptyLabel: "No grade" })
    ),
    marketConditions: sortByNetRDesc(
      groupStats(trades, (t) => t.marketCondition, { emptyLabel: "No condition" })
    ),
    timeframes: sortByNetRDesc(
      groupStats(trades, (t) => t.timeframe?.trim(), { emptyLabel: "No timeframe" })
    ),
    plannedR: plannedRInsights(trades),
    excursions: buildExcursions(trades, input.excursions, input.excursionSplits),
    exitReasons: toExitReasons(input.exitReasons),
  };
}

/** Stable cache key for deduplicating AI calls when filters haven't changed. */
export function snapshotCacheKey(snapshot: ReportSnapshot): string {
  return JSON.stringify(snapshot);
}
