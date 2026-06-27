import type {
  Direction,
  ExitReason,
  Grade,
  MarketCondition,
  Result,
  Session,
} from "../types";

export const DIRECTIONS: Direction[] = ["Long", "Short"];
export const GRADES: Grade[] = ["A", "B", "C", "D"];
export const RESULTS: Result[] = ["Win", "Break Even", "Loss"];
export const SESSIONS: Session[] = ["Asia", "London", "New York", "Other"];
export const MARKET_CONDITIONS: MarketCondition[] = [
  "Trend",
  "Range",
  "Chop",
  "High Volatility",
  "Low Volatility",
  "Other",
];
export const EXIT_REASONS: ExitReason[] = [
  "TP",
  "SL",
  "Manual",
  "Break Even",
  "Invalidation",
  "Partial",
  "Other",
];
