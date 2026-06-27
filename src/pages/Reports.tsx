import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import {
  computeStats,
  fmtNum,
  fmtPct,
  fmtR,
  groupStats,
  weekdayStats,
  type GroupStat,
} from "../lib/analytics";
import { applyFilters, emptyFilters, type TradeFilters } from "../lib/filters";
import FilterBar from "../components/FilterBar";
import { StatCard, EmptyState, RCell } from "../components/ui";

export default function Reports() {
  const { trades, loading } = useData();
  const [filters, setFilters] = useState<TradeFilters>(emptyFilters);

  const filtered = useMemo(() => applyFilters(trades, filters), [trades, filters]);

  const setupStats = useMemo(
    () =>
      groupStats(filtered, (t) => t.setup, { emptyLabel: "No setup" }).sort(
        (a, b) => b.netR - a.netR
      ),
    [filtered]
  );
  const mistakeStats = useMemo(
    () =>
      groupStats(
        filtered.filter((t) => t.mistake && t.mistake.trim()),
        (t) => t.mistake
      ).sort((a, b) => a.netR - b.netR),
    [filtered]
  );
  const coinStats = useMemo(
    () => groupStats(filtered, (t) => t.coin).sort((a, b) => b.netR - a.netR),
    [filtered]
  );
  const longStats = useMemo(
    () => computeStats(filtered.filter((t) => t.direction === "Long")),
    [filtered]
  );
  const shortStats = useMemo(
    () => computeStats(filtered.filter((t) => t.direction === "Short")),
    [filtered]
  );
  const weekdays = useMemo(() => weekdayStats(filtered), [filtered]);

  return (
    <div className="page section-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">{filtered.length} trades in view</p>
        </div>
      </div>

      <FilterBar trades={trades} filters={filters} onChange={setFilters} />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No trades match your filters" />
      ) : (
        <>
          <div className="report-block">
            <h3>Long vs Short</h3>
            <div className="lvs-grid">
              <StatCard
                label="Long Net R"
                value={fmtR(longStats.netR)}
                tone={longStats.netR > 0 ? "pos" : longStats.netR < 0 ? "neg" : ""}
                sub={`${longStats.count} trades`}
              />
              <StatCard label="Long Win %" value={fmtPct(longStats.winRate)} />
              <StatCard
                label="Short Net R"
                value={fmtR(shortStats.netR)}
                tone={shortStats.netR > 0 ? "pos" : shortStats.netR < 0 ? "neg" : ""}
                sub={`${shortStats.count} trades`}
              />
              <StatCard label="Short Win %" value={fmtPct(shortStats.winRate)} />
            </div>
          </div>

          <div className="report-block">
            <h3>Setup performance</h3>
            <FullStatTable rows={setupStats} keyLabel="Setup" />
          </div>

          <div className="report-block">
            <h3>Mistake performance</h3>
            {mistakeStats.length === 0 ? (
              <div className="empty-state">No mistakes tagged.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Mistake</th>
                      <th>Count</th>
                      <th>Net R</th>
                      <th>Avg R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mistakeStats.map((g) => (
                      <tr key={g.key}>
                        <td>{g.key}</td>
                        <td className="mono">{g.count}</td>
                        <td>
                          <RCell value={g.netR} />
                        </td>
                        <td>
                          <RCell value={g.expectancy} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="report-block">
            <h3>Coin performance</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Coin</th>
                    <th>Trades</th>
                    <th>Win %</th>
                    <th>Net R</th>
                    <th>Avg R</th>
                  </tr>
                </thead>
                <tbody>
                  {coinStats.map((g) => (
                    <tr key={g.key}>
                      <td>{g.key}</td>
                      <td className="mono">{g.count}</td>
                      <td className="mono">{fmtPct(g.winRate)}</td>
                      <td>
                        <RCell value={g.netR} />
                      </td>
                      <td>
                        <RCell value={g.expectancy} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="report-block">
            <h3>Weekday performance</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Trades</th>
                    <th>Net R</th>
                    <th>Avg R</th>
                  </tr>
                </thead>
                <tbody>
                  {weekdays.map((g) => (
                    <tr key={g.key}>
                      <td>{g.key}</td>
                      <td className="mono">{g.count}</td>
                      <td>
                        {g.count ? <RCell value={g.netR} /> : <span className="faint">—</span>}
                      </td>
                      <td>
                        {g.count ? <RCell value={g.expectancy} /> : <span className="faint">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FullStatTable({ rows, keyLabel }: { rows: GroupStat[]; keyLabel: string }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>{keyLabel}</th>
            <th>Trades</th>
            <th>Win %</th>
            <th>Net R</th>
            <th>Avg R</th>
            <th>Expectancy</th>
            <th>Profit Factor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.key}>
              <td>{g.key}</td>
              <td className="mono">{g.count}</td>
              <td className="mono">{fmtPct(g.winRate)}</td>
              <td>
                <RCell value={g.netR} />
              </td>
              <td>
                <RCell value={g.expectancy} />
              </td>
              <td>
                <RCell value={g.expectancy} />
              </td>
              <td className="mono">{fmtNum(g.profitFactor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
