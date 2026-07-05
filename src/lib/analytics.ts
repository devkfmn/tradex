import type { Direction, Result, Trade } from "../types";

/** Derive a trade result from realized R. */
export function resultFromR(realizedR: number | null | undefined): Result | null {
  if (realizedR === null || realizedR === undefined || Number.isNaN(realizedR))
    return null;
  if (realizedR > 0.1) return "Win";
  if (realizedR < -0.1) return "Loss";
  return "Break Even";
}

/** Compute planned R from entry/stop/target respecting direction. */
export function plannedR(
  entry: number | null | undefined,
  stop: number | null | undefined,
  target: number | null | undefined,
  direction: Direction
): number | null {
  if (entry == null || stop == null || target == null) return null;
  const risk = direction === "Long" ? entry - stop : stop - entry;
  const reward = direction === "Long" ? target - entry : entry - target;
  if (!risk || risk <= 0) return null;
  const r = reward / risk;
  return safeNum(r);
}

/** Compute realized R from pnl and risk in USD. */
export function realizedRFromPnl(
  pnl: number | null | undefined,
  riskUsd: number | null | undefined
): number | null {
  if (pnl == null || riskUsd == null || riskUsd === 0) return null;
  return safeNum(pnl / Math.abs(riskUsd));
}

function safeNum(n: number): number | null {
  if (n == null || Number.isNaN(n) || !Number.isFinite(n)) return null;
  return n;
}

/** Trades that have a usable realized R value. */
export function tradesWithR(trades: Trade[]): { trade: Trade; r: number }[] {
  return trades
    .filter((t) => t.realizedR != null && Number.isFinite(t.realizedR))
    .map((t) => ({ trade: t, r: t.realizedR as number }));
}

/** Trades that have a usable PnL value. */
export function tradesWithPnl(trades: Trade[]): { trade: Trade; pnl: number }[] {
  return trades
    .filter((t) => t.pnl != null && Number.isFinite(t.pnl))
    .map((t) => ({ trade: t, pnl: t.pnl as number }));
}

/** Duplicate each trade once per mistake tag for grouped mistake stats. */
export function expandTradesByMistake(trades: Trade[]): Trade[] {
  return trades.flatMap((t) =>
    t.mistakes.length
      ? t.mistakes.map((mistake) => ({ ...t, mistakes: [mistake] }))
      : []
  );
}

export interface Stats {
  count: number;
  netR: number;
  netPnl: number;
  hasPnl: boolean;
  winRate: number | null;
  avgWinR: number | null;
  avgLossR: number | null; // absolute value
  expectancy: number | null;
  profitFactor: number | null;
  maxDrawdown: number;
  wins: number;
  losses: number;
  breakEvens: number;
}

export function computeStats(trades: Trade[]): Stats {
  const rows = tradesWithR(trades);
  const count = rows.length;

  const pnls = trades
    .map((t) => t.pnl)
    .filter((p): p is number => p != null && Number.isFinite(p));
  const netPnl = sum(pnls);
  const hasPnl = pnls.length > 0;

  if (count === 0) {
    return {
      count: 0,
      netR: 0,
      netPnl,
      hasPnl,
      winRate: null,
      avgWinR: null,
      avgLossR: null,
      expectancy: null,
      profitFactor: null,
      maxDrawdown: 0,
      wins: 0,
      losses: 0,
      breakEvens: 0,
    };
  }

  const rs = rows.map((x) => x.r);
  const winRs = rs.filter((r) => r > 0.1);
  const lossRs = rs.filter((r) => r < -0.1);
  const beRs = rs.filter((r) => r >= -0.1 && r <= 0.1);

  const netR = sum(rs);
  const grossWin = sum(winRs);
  const grossLoss = Math.abs(sum(lossRs));

  const sortedRs = rows
    .slice()
    .sort((a, b) => a.trade.date.localeCompare(b.trade.date))
    .map((x) => x.r);

  return {
    count,
    netR,
    netPnl,
    hasPnl,
    winRate: count > 0 ? winRs.length / count : null,
    avgWinR: winRs.length > 0 ? grossWin / winRs.length : null,
    avgLossR: lossRs.length > 0 ? grossLoss / lossRs.length : null,
    expectancy: count > 0 ? netR / count : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    maxDrawdown: maxDrawdown(sortedRs),
    wins: winRs.length,
    losses: lossRs.length,
    breakEvens: beRs.length,
  };
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

/** Largest peak-to-trough drop on the cumulative R curve (returned as a positive number). */
export function maxDrawdown(rs: number[]): number {
  let peak = 0;
  let cum = 0;
  let maxDd = 0;
  for (const r of rs) {
    cum += r;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

export interface CumPoint {
  index: number;
  date: string;
  cumR: number;
  r: number;
}

/** Cumulative R curve ordered by date ascending. */
export function cumulativeRCurve(trades: Trade[]): CumPoint[] {
  const rows = tradesWithR(trades)
    .slice()
    .sort((a, b) => a.trade.date.localeCompare(b.trade.date));
  let cum = 0;
  return rows.map((row, i) => {
    cum += row.r;
    return { index: i + 1, date: row.trade.date, cumR: round(cum), r: row.r };
  });
}

export interface CumPnlPoint {
  index: number;
  date: string;
  cumPnl: number;
  pnl: number;
}

/** Cumulative PnL curve ordered by date ascending. */
export function cumulativePnlCurve(trades: Trade[]): CumPnlPoint[] {
  const rows = tradesWithPnl(trades)
    .slice()
    .sort((a, b) => a.trade.date.localeCompare(b.trade.date));
  let cum = 0;
  return rows.map((row, i) => {
    cum += row.pnl;
    return { index: i + 1, date: row.trade.date, cumPnl: round(cum), pnl: row.pnl };
  });
}

export interface GroupStat extends Stats {
  key: string;
  bestTradeR: number | null;
  worstTradeR: number | null;
}

/** Group trades by a string key extractor and compute stats for each group. */
export function groupStats(
  trades: Trade[],
  keyFn: (t: Trade) => string | undefined | null,
  opts: { emptyLabel?: string } = {}
): GroupStat[] {
  const buckets = new Map<string, Trade[]>();
  for (const t of trades) {
    const raw = keyFn(t);
    const key = raw && raw.trim() ? raw.trim() : opts.emptyLabel ?? "—";
    const arr = buckets.get(key) ?? [];
    arr.push(t);
    buckets.set(key, arr);
  }
  const out: GroupStat[] = [];
  for (const [key, arr] of buckets) {
    const stats = computeStats(arr);
    const rs = tradesWithR(arr).map((x) => x.r);
    out.push({
      key,
      ...stats,
      bestTradeR: rs.length ? Math.max(...rs) : null,
      worstTradeR: rs.length ? Math.min(...rs) : null,
    });
  }
  return out;
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Weekday performance Monday..Sunday (always returns all 7 rows). */
export function weekdayStats(trades: Trade[]): GroupStat[] {
  const order = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
  const byDay = new Map<number, Trade[]>();
  for (const t of trades) {
    const d = new Date(t.date + "T00:00:00");
    const day = Number.isNaN(d.getTime()) ? -1 : d.getDay();
    if (day < 0) continue;
    const arr = byDay.get(day) ?? [];
    arr.push(t);
    byDay.set(day, arr);
  }
  return order.map((day) => {
    const arr = byDay.get(day) ?? [];
    const stats = computeStats(arr);
    const rs = tradesWithR(arr).map((x) => x.r);
    return {
      key: WEEKDAYS[day],
      ...stats,
      bestTradeR: rs.length ? Math.max(...rs) : null,
      worstTradeR: rs.length ? Math.min(...rs) : null,
    };
  });
}

/** Session performance Asia → Other, plus unset trades (always returns 5 rows). */
export function sessionStats(trades: Trade[]): GroupStat[] {
  const bySession = new Map<string, Trade[]>();
  for (const t of trades) {
    const key = t.session?.trim() || "No session";
    const arr = bySession.get(key) ?? [];
    arr.push(t);
    bySession.set(key, arr);
  }
  const order = ["Asia", "London", "New York", "Other", "No session"];
  return order.map((key) => {
    const arr = bySession.get(key) ?? [];
    const stats = computeStats(arr);
    const rs = tradesWithR(arr).map((x) => x.r);
    return {
      key,
      ...stats,
      bestTradeR: rs.length ? Math.max(...rs) : null,
      worstTradeR: rs.length ? Math.min(...rs) : null,
    };
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------- formatting helpers (NaN/Infinity safe) ----------

export function fmtR(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = n.toFixed(digits);
  return `${n > 0 ? "+" : ""}${v}R`;
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function signClass(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || Math.abs(n) < 1e-9) return "";
  return n > 0 ? "pos" : "neg";
}
