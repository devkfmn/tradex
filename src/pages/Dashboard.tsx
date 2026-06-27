import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "../context/DataContext";
import {
  computeStats,
  cumulativeRCurve,
  fmtNum,
  fmtPct,
  fmtR,
  groupStats,
  signClass,
} from "../lib/analytics";
import { StatCard, EmptyState } from "../components/ui";

export default function Dashboard() {
  const { trades, loading } = useData();

  const stats = useMemo(() => computeStats(trades), [trades]);
  const curve = useMemo(() => cumulativeRCurve(trades), [trades]);

  const setupGroups = useMemo(
    () => groupStats(trades, (t) => t.setup, { emptyLabel: "No setup" }),
    [trades]
  );
  const mistakeGroups = useMemo(
    () =>
      groupStats(
        trades.filter((t) => t.mistake && t.mistake.trim()),
        (t) => t.mistake
      ),
    [trades]
  );

  const bestSetup = useMemo(
    () =>
      [...setupGroups]
        .filter((g) => g.count > 0)
        .sort((a, b) => b.netR - a.netR)[0],
    [setupGroups]
  );
  const worstSetup = useMemo(
    () =>
      [...setupGroups]
        .filter((g) => g.count > 0)
        .sort((a, b) => a.netR - b.netR)[0],
    [setupGroups]
  );
  const worstMistake = useMemo(
    () => [...mistakeGroups].sort((a, b) => a.netR - b.netR)[0],
    [mistakeGroups]
  );

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading dashboard…</p>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
        </div>
        <EmptyState
          title="Nothing to analyze yet"
          hint="Log a few trades and your performance metrics will appear here."
          action={
            <Link to="/trades/new" className="btn btn-primary">
              <Plus size={16} /> Add your first trade
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page section-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {stats.count} trades with results · {trades.length} logged
          </p>
        </div>
        <Link to="/trades/new" className="btn btn-primary">
          <Plus size={16} /> Add Trade
        </Link>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Net R"
          value={fmtR(stats.netR)}
          tone={stats.netR > 0 ? "pos" : stats.netR < 0 ? "neg" : ""}
        />
        <StatCard label="Win rate" value={fmtPct(stats.winRate)} sub={`${stats.wins}W / ${stats.losses}L / ${stats.breakEvens}BE`} />
        <StatCard label="Avg win" value={fmtR(stats.avgWinR)} />
        <StatCard
          label="Avg loss"
          value={stats.avgLossR == null ? "—" : `-${stats.avgLossR.toFixed(2)}R`}
        />
        <StatCard label="Expectancy" value={fmtR(stats.expectancy)} sub="per trade" />
        <StatCard label="Profit factor" value={fmtNum(stats.profitFactor)} />
        <StatCard
          label="Max drawdown"
          value={stats.maxDrawdown > 0 ? `-${stats.maxDrawdown.toFixed(2)}R` : "0.00R"}
        />
        <StatCard label="Trades taken" value={stats.count} />
      </div>

      <div className="chart-card">
        <h3>Cumulative R</h3>
        {curve.length === 0 ? (
          <p className="muted">No trades with realized R yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={curve} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#232a3a" strokeDasharray="3 3" />
              <XAxis
                dataKey="index"
                stroke="#5b6577"
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke="#5b6577"
                tick={{ fontSize: 11 }}
                tickLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: "#141925",
                  border: "1px solid #2e3850",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#8a93a6" }}
                formatter={(value: number) => [`${value}R`, "Cumulative"]}
                labelFormatter={(i) => {
                  const p = curve[(i as number) - 1];
                  return p ? `Trade ${i} · ${p.date}` : `Trade ${i}`;
                }}
              />
              <Line
                type="monotone"
                dataKey="cumR"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="insight-grid">
        <div className="insight-card">
          <h4>Best setup</h4>
          {bestSetup ? (
            <>
              <div className={`insight-value ${signClass(bestSetup.netR)}`}>
                {bestSetup.key}
              </div>
              <div className="insight-meta">
                {fmtR(bestSetup.netR)} net · {fmtR(bestSetup.expectancy)} exp ·{" "}
                {bestSetup.count} trade{bestSetup.count === 1 ? "" : "s"}
              </div>
            </>
          ) : (
            <div className="muted">—</div>
          )}
        </div>
        <div className="insight-card">
          <h4>Worst setup</h4>
          {worstSetup ? (
            <>
              <div className={`insight-value ${signClass(worstSetup.netR)}`}>
                {worstSetup.key}
              </div>
              <div className="insight-meta">
                {fmtR(worstSetup.netR)} net · {fmtR(worstSetup.expectancy)} exp ·{" "}
                {worstSetup.count} trade{worstSetup.count === 1 ? "" : "s"}
              </div>
            </>
          ) : (
            <div className="muted">—</div>
          )}
        </div>
        <div className="insight-card">
          <h4>Most expensive mistake</h4>
          {worstMistake && worstMistake.netR < 0 ? (
            <>
              <div className="insight-value neg">{worstMistake.key}</div>
              <div className="insight-meta">
                {fmtR(worstMistake.netR)} net · {worstMistake.count} trade
                {worstMistake.count === 1 ? "" : "s"}
              </div>
            </>
          ) : (
            <div className="muted">No costly mistakes logged.</div>
          )}
        </div>
      </div>
    </div>
  );
}
