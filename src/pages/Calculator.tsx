import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Copy, RefreshCw } from "lucide-react";
import { StatCard } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { EXCHANGES } from "../lib/constants";
import { fmtNum, fmtPct, fmtUsd } from "../lib/analytics";
import { fetchMexcFuturesEquity } from "../lib/mexcClient";
import { getExchangeCredentials } from "../services/exchangeCredentials";
import type { ExchangeId, TradePlanPrefill } from "../types";

const LEVERAGE_BUFFER = 1.25; // validation: liquidation should be 25% farther than the stop
const MAX_LEVERAGE = 125;

const STORAGE_KEYS = {
  balance: "tradex.calc.balance",
  exchange: "tradex.calc.exchange",
  riskPct: "tradex.calc.riskPct",
  entry: "tradex.calc.entry",
  stop: "tradex.calc.stop",
  target: "tradex.calc.target",
};

type BalanceStatus = "idle" | "loading" | "success" | "error";

function usePersistentState(key: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  });
  const update = (v: string) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      // storage unavailable; ignore
    }
  };
  return [value, update];
}

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type Calc = {
  direction: "Long" | "Short";
  stopDistFrac: number;
  riskAmount: number;
  size: number;
  loss: number;
  profit: number | null;
  rFactor: number | null;
  leverage: number;
  margin: number;
  liquidation: number;
  marginExceedsBalance: boolean;
  liquidationTooClose: boolean;
  tpWrongSide: boolean;
};

function roundLeverageUp(leverage: number): number {
  return Math.ceil(leverage / 5) * 5;
}

function compute(
  balance: number | null,
  riskPct: number | null,
  entry: number | null,
  stop: number | null,
  target: number | null
): Calc | null {
  if (
    balance == null ||
    riskPct == null ||
    entry == null ||
    stop == null ||
    balance <= 0 ||
    riskPct <= 0 ||
    entry <= 0 ||
    stop <= 0 ||
    entry === stop
  ) {
    return null;
  }

  const direction = stop < entry ? "Long" : "Short";
  const stopDistFrac = Math.abs(entry - stop) / entry;
  if (!Number.isFinite(stopDistFrac) || stopDistFrac <= 0) return null;

  const riskAmount = balance * (riskPct / 100);
  const size = riskAmount / stopDistFrac;
  if (!Number.isFinite(size) || size <= 0) return null;

  const loss = riskAmount;

  let profit: number | null = null;
  let rFactor: number | null = null;
  let tpWrongSide = false;
  if (target != null && target > 0) {
    const onRightSide =
      direction === "Long" ? target > entry : target < entry;
    if (onRightSide) {
      profit = (size * Math.abs(target - entry)) / entry;
      rFactor = Math.abs(target - entry) / Math.abs(entry - stop);
    } else {
      tpWrongSide = true;
    }
  }

  let leverage = roundLeverageUp(Math.ceil(size / balance));
  if (!Number.isFinite(leverage) || leverage < 5) leverage = 5;
  if (leverage > MAX_LEVERAGE) leverage = MAX_LEVERAGE;

  let maxSafeLeverage = Math.floor(1 / (stopDistFrac * LEVERAGE_BUFFER));
  if (!Number.isFinite(maxSafeLeverage) || maxSafeLeverage < 1) maxSafeLeverage = 1;
  const liquidationTooClose = leverage > maxSafeLeverage;

  const margin = size / leverage;
  const liquidation =
    direction === "Long"
      ? entry * (1 - 1 / leverage)
      : entry * (1 + 1 / leverage);

  return {
    direction,
    stopDistFrac,
    riskAmount,
    size,
    loss,
    profit,
    rFactor,
    leverage,
    margin,
    liquidation,
    marginExceedsBalance: margin > balance,
    liquidationTooClose,
    tpWrongSide,
  };
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable; ignore
    }
  };
  return (
    <div className="copy-row">
      <span className="copy-row-label">{label}</span>
      <span className="copy-row-value mono">{value}</span>
      <button
        type="button"
        className="btn-ghost copy-row-btn"
        onClick={copy}
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

export default function Calculator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [balance, setBalance] = usePersistentState(STORAGE_KEYS.balance);
  const [exchangeRaw, setExchangeRaw] = usePersistentState(STORAGE_KEYS.exchange);
  const [riskPct, setRiskPct] = usePersistentState(STORAGE_KEYS.riskPct);
  const [entry, setEntry] = usePersistentState(STORAGE_KEYS.entry);
  const [stop, setStop] = usePersistentState(STORAGE_KEYS.stop);
  const [target, setTarget] = usePersistentState(STORAGE_KEYS.target);

  const exchange: ExchangeId = exchangeRaw === "mexc" ? "mexc" : "";

  const setExchange = (id: ExchangeId) => {
    setExchangeRaw(id);
  };

  const [mexcCredentials, setMexcCredentials] = useState<{
    apiKey: string;
    apiSecret: string;
  } | null>(null);
  const [credsLoaded, setCredsLoaded] = useState(false);
  const [liveEquity, setLiveEquity] = useState<number | null>(null);
  const [balanceStatus, setBalanceStatus] = useState<BalanceStatus>("idle");
  const [balanceError, setBalanceError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setMexcCredentials(null);
      setCredsLoaded(true);
      return;
    }
    let active = true;
    (async () => {
      try {
        const creds = await getExchangeCredentials(user.uid);
        if (!active) return;
        setMexcCredentials(creds.mexc ?? null);
      } catch {
        if (active) setMexcCredentials(null);
      } finally {
        if (active) setCredsLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const refreshLiveEquity = useCallback(async () => {
    if (exchange !== "mexc" || !mexcCredentials) {
      setLiveEquity(null);
      setBalanceStatus("idle");
      setBalanceError(null);
      return;
    }

    setBalanceStatus("loading");
    setBalanceError(null);
    try {
      const equity = await fetchMexcFuturesEquity(
        mexcCredentials.apiKey,
        mexcCredentials.apiSecret
      );
      setLiveEquity(equity);
      setBalanceStatus("success");
    } catch (err) {
      setLiveEquity(null);
      setBalanceStatus("error");
      setBalanceError(
        err instanceof Error ? err.message : "Failed to fetch balance"
      );
    }
  }, [exchange, mexcCredentials]);

  useEffect(() => {
    if (exchange !== "mexc" || !credsLoaded) {
      setLiveEquity(null);
      setBalanceStatus("idle");
      setBalanceError(null);
      return;
    }
    if (!mexcCredentials) {
      setLiveEquity(null);
      setBalanceStatus("idle");
      setBalanceError(null);
      return;
    }
    void refreshLiveEquity();
  }, [exchange, mexcCredentials, credsLoaded, refreshLiveEquity]);

  const useLiveBalance =
    exchange === "mexc" && balanceStatus === "success" && liveEquity != null;

  const effectiveBalance = useLiveBalance ? liveEquity : num(balance);

  const calc = useMemo(
    () =>
      compute(
        effectiveBalance,
        num(riskPct),
        num(entry),
        num(stop),
        num(target)
      ),
    [effectiveBalance, riskPct, entry, stop, target]
  );

  const dash = "—";

  const addTrade = () => {
    if (!calc) return;
    const prefill: TradePlanPrefill = {
      entry,
      stop,
      target,
      direction: calc.direction,
      riskPct,
      riskUsd: String(calc.riskAmount),
    };
    navigate("/trades/new", { state: prefill });
  };

  const showReadOnlyBalance =
    exchange === "mexc" &&
    mexcCredentials &&
    (balanceStatus === "loading" || balanceStatus === "success");

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calculator</h1>
          <p className="page-subtitle">
            Size a position from your risk, then copy the order values.
          </p>
        </div>
      </div>

      <div className="card form-section">
        <div className="section-title">Inputs</div>
        <div className="form-grid">
          <div>
            <label htmlFor="calc-exchange">Exchange</label>
            <select
              id="calc-exchange"
              value={exchange}
              onChange={(e) => setExchange(e.target.value as ExchangeId)}
            >
              {EXCHANGES.map(({ id, label }) => (
                <option key={id || "manual"} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="calc-balance">Account Balance (USDT)</label>
            {showReadOnlyBalance ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  id="calc-balance"
                  type="text"
                  readOnly
                  value={
                    balanceStatus === "loading"
                      ? "Loading…"
                      : liveEquity != null
                        ? fmtNum(liveEquity)
                        : dash
                  }
                  style={{ flex: 1 }}
                />
                {balanceStatus === "success" && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void refreshLiveEquity()}
                    aria-label="Refresh balance"
                  >
                    <RefreshCw size={16} />
                  </button>
                )}
              </div>
            ) : (
              <input
                id="calc-balance"
                type="number"
                step="any"
                placeholder="1000"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            )}
            {exchange === "mexc" && !mexcCredentials && credsLoaded && (
              <div className="computed">
                <Link to="/settings">Add MEXC credentials in Settings</Link> to
                load balance automatically.
              </div>
            )}
            {exchange === "mexc" && balanceStatus === "error" && balanceError && (
              <div className="computed" style={{ color: "var(--red)" }}>
                {balanceError}{" "}
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: 0, fontSize: "inherit" }}
                  onClick={() => void refreshLiveEquity()}
                >
                  Retry
                </button>
              </div>
            )}
            {useLiveBalance && (
              <div className="computed">Live futures equity from MEXC</div>
            )}
          </div>
          <div>
            <label>Risk %</label>
            <input
              type="number"
              step="any"
              placeholder="1"
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
            />
            {calc && (
              <div className="computed">
                Risking {fmtUsd(calc.riskAmount)}
              </div>
            )}
          </div>
          <div>
            <label>Entry</label>
            <input
              type="number"
              step="any"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
            />
          </div>
          <div>
            <label>Stop Loss</label>
            <input
              type="number"
              step="any"
              value={stop}
              onChange={(e) => setStop(e.target.value)}
            />
            {calc && (
              <div className="computed">
                {calc.direction} · stop {fmtPct(calc.stopDistFrac)} away
              </div>
            )}
          </div>
          <div>
            <label>Take Profit</label>
            <input
              type="number"
              step="any"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            {calc?.tpWrongSide && (
              <div className="computed" style={{ color: "var(--red)" }}>
                TP is on the wrong side of entry for a {calc.direction}.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card form-section">
        <div className="section-title">Read only</div>
        <div className="stat-grid">
          <StatCard
            label="R Factor"
            value={calc?.rFactor != null ? `${fmtNum(calc.rFactor)}R` : dash}
            tone={
              calc?.rFactor != null
                ? calc.rFactor >= 1
                  ? "pos"
                  : "neg"
                : ""
            }
          />
          <StatCard
            label="Profit"
            value={calc?.profit != null ? fmtUsd(calc.profit) : dash}
            tone={calc?.profit != null ? "pos" : ""}
          />
          <StatCard
            label="Loss"
            value={calc ? fmtUsd(-calc.loss) : dash}
            tone={calc ? "neg" : ""}
          />
          <StatCard
            label="Liquidation Price"
            value={calc ? fmtNum(calc.liquidation) : dash}
            sub={
              calc?.liquidationTooClose ? (
                <span className="neg">
                  Closer than your stop (incl. 25% buffer). Consider a smaller size
                  or wider stop.
                </span>
              ) : undefined
            }
          />
          <StatCard
            label="Margin used"
            value={calc ? fmtUsd(calc.margin) : dash}
            sub={
              calc?.marginExceedsBalance ? (
                <span className="neg">Exceeds balance</span>
              ) : undefined
            }
          />
        </div>
      </div>

      <div className="card form-section">
        <div className="section-title">Order</div>
        {calc ? (
          <div className="copy-list">
            <CopyRow label="Leverage" value={`${calc.leverage}x`} />
            <CopyRow label="Entry" value={fmtNum(num(entry) ?? 0)} />
            <CopyRow label="Size (USDT)" value={fmtNum(calc.size)} />
            <CopyRow
              label="Take Profit"
              value={num(target) != null ? fmtNum(num(target) as number) : dash}
            />
            <CopyRow label="Stop Loss" value={fmtNum(num(stop) ?? 0)} />
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Enter balance, risk %, entry, and stop loss to see your order.
          </p>
        )}
        {calc && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={addTrade}
          >
            Add Trade
          </button>
        )}
      </div>
    </div>
  );
}
