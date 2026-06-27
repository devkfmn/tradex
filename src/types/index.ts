export type Direction = "Long" | "Short";
export type Grade = "A" | "B" | "C" | "D";
export type Result = "Win" | "Break Even" | "Loss";
export type Session = "Asia" | "London" | "New York" | "Other";
export type MarketCondition =
  | "Trend"
  | "Range"
  | "Chop"
  | "High Volatility"
  | "Low Volatility"
  | "Other";
export type ExitReason =
  | "TP"
  | "SL"
  | "Manual"
  | "Break Even"
  | "Invalidation"
  | "Partial"
  | "Other";
export type RuleFollowed = "Yes" | "No" | "Mixed";

export interface Trade {
  id: string;
  date: string; // ISO date string (yyyy-MM-dd)
  coin: string;
  direction: Direction;
  setup: string;
  riskPct: number | null;
  riskUsd: number | null;
  pnl: number | null;
  realizedR: number | null;
  grade: Grade | "";
  mistake: string;
  postNotes: string;
  screenshotUrls: string[];

  // optional / supported
  entry?: number | null;
  stop?: number | null;
  target?: number | null;
  exit?: number | null;
  timeframe?: string;
  session?: Session | "";
  marketCondition?: MarketCondition | "";
  exitReason?: ExitReason | "";
  plannedR?: number | null;
  maxFavorableR?: number | null;
  maxAdverseR?: number | null;
  didHitPlannedTp?: boolean | null;
  thesis?: string;

  createdAt?: number | null;
  updatedAt?: number | null;
}

export type TradeInput = Omit<Trade, "id">;

export interface Setup {
  id: string;
  name: string;
  rules: string;
  bestConditions: string;
  invalidConditions: string;
  createdAt?: number | null;
  updatedAt?: number | null;
}

export type SetupInput = Omit<Setup, "id">;

export interface Review {
  id: string;
  weekStartDate: string; // ISO date string of the Monday
  totalR: number | null;
  bestSetup: string;
  worstSetup: string;
  mainMistake: string;
  bestTrade: string;
  worstTrade: string;
  ruleFollowed: RuleFollowed | "";
  decisionNextWeek: string;
  createdAt?: number | null;
  updatedAt?: number | null;
}

export type ReviewInput = Omit<Review, "id">;
