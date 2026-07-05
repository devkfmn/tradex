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

export interface Trade {
  id: string;
  date: string; // ISO storage format (yyyy-MM-dd); display via fmtDate()
  coin: string;
  direction: Direction;
  setup: string;
  riskPct: number | null;
  riskUsd: number | null;
  pnl: number | null;
  realizedR: number | null;
  grade: Grade | "";
  mistakes: string[];
  postNotes: string;
  screenshotUrls: string[];

  // optional / supported
  entry?: number | null;
  stop?: number | null;
  target?: number | null;
  timeframe?: string;
  session?: Session | "";
  marketCondition?: MarketCondition | "";
  exitReason?: ExitReason | "";
  plannedR?: number | null;
  maxFavorableR?: number | null;
  maxAdverseR?: number | null;
  thesis?: string;

  createdAt?: number | null;
  updatedAt?: number | null;
}

export type TradeInput = Omit<Trade, "id">;

export type TradePlanPrefill = {
  entry: string;
  stop: string;
  target: string;
  direction: Direction;
  riskPct: string;
  riskUsd: string;
};

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

export interface Mistake {
  id: string;
  name: string;
  description: string;
  createdAt?: number | null;
  updatedAt?: number | null;
}

export type MistakeInput = Omit<Mistake, "id">;

export type ExchangeId = "" | "mexc";

export interface MexcCredentials {
  apiKey: string;
  apiSecret: string;
}

export interface ExchangeCredentials {
  mexc?: MexcCredentials & { updatedAt?: number | null };
}
