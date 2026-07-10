import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import DateRangeBar, {
  loadDatePreset,
  saveDatePreset,
  type DatePreset,
} from "../components/DateRangeBar";
import {
  computeStats,
  excursionSplitStats,
  excursionStats,
  exitReasonStats,
  expandTradesByMistake,
  fmtNum,
  fmtPct,
  fmtR,
  fmtUsd,
  groupStats,
  signClass,
  sessionStats,
  weekdayStats,
  type GroupStat,
} from "../lib/analytics";
import { formatDateRangeLabel } from "../lib/dates";
import {
  applyFilters,
  emptyFilters,
  filterTradesByDateRange,
  presetToDateRange,
  type TradeFilters,
} from "../lib/filters";
import FilterBar from "../components/FilterBar";
import ReportSummaryCard from "../components/ReportSummaryCard";
import { StatCard, EmptyState, RCell } from "../components/ui";
import { buildReportSnapshot } from "../lib/reportSnapshot";

export default function Reports() {
  const { trades, mistakes, loading } = useData();
  const [filters, setFilters] = useState<TradeFilters>(emptyFilters);
  const [preset, setPreset] = useState<DatePreset>(() => loadDatePreset());
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to } = useMemo(() => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    return presetToDateRange(preset);
  }, [preset, customFrom, customTo]);

  const dateFiltered = useMemo(
    () => filterTradesByDateRange(trades, from, to),
    [trades, from, to]
  );

  const filtered = useMemo(
    () => applyFilters(dateFiltered, filters),
    [dateFiltered, filters]
  );

  const rangeLabel = useMemo(
    () => formatDateRangeLabel(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const handlePresetChange = (next: DatePreset) => {
    setPreset(next);
    saveDatePreset(next);
  };

  const setupStats = useMemo(
    () =>
      groupStats(filtered, (t) => t.setup, { emptyLabel: "No setup" }).sort(
        (a, b) => b.netR - a.netR
      ),
    [filtered]
  );
  const mistakeStats = useMemo(
    () =>
      groupStats(expandTradesByMistake(filtered), (t) => t.mistakes[0]).sort(
        (a, b) => a.netR - b.netR
      ),
    [filtered]
  );
  const coinStats = useMemo(
    () => groupStats(filtered, (t) => t.coin).sort((a, b) => b.netR - a.netR),
    [filtered]
  );
  const sessions = useMemo(() => sessionStats(filtered), [filtered]);
  const longStats = useMemo(
    () => computeStats(filtered.filter((t) => t.direction === "Long")),
    [filtered]
  );
  const shortStats = useMemo(
    () => computeStats(filtered.filter((t) => t.direction === "Short")),
    [filtered]
  );
  const weekdays = useMemo(() => weekdayStats(filtered), [filtered]);
  const excursions = useMemo(() => excursionStats(filtered), [filtered]);
  const excursionSplits = useMemo(() => excursionSplitStats(filtered), [filtered]);
  const exitReasons = useMemo(
    () => exitReasonStats(filtered),
    [filtered]
  );
  const overallStats = useMemo(() => computeStats(filtered), [filtered]);
  const reportSnapshot = useMemo(
    () =>
      buildReportSnapshot({
        rangeLabel,
        from,
        to,
        tradeCount: filtered.length,
        filters,
        trades: filtered,
        overall: overallStats,
        longStats,
        shortStats,
        setupStats,
        mistakeStats,
        coinStats,
        sessions,
        weekdays,
        excursions,
        excursionSplits,
        exitReasons,
      }),
    [
      rangeLabel,
      from,
      to,
      filtered.length,
      filters,
      overallStats,
      longStats,
      shortStats,
      setupStats,
      mistakeStats,
      coinStats,
      sessions,
      weekdays,
      excursions,
      excursionSplits,
      exitReasons,
    ]
  );
  const hasExcursionData = excursions.countWithMfe > 0 || excursions.countWithMae > 0;
  const hasExitReasonData = filtered.some((t) => t.exitReason?.trim());

  return (
    <div className="page section-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            {rangeLabel} · {filtered.length} of {trades.length} trades
          </p>
        </div>
      </div>

      <div className="filters-section">
        <DateRangeBar
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onPresetChange={handlePresetChange}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />

        <FilterBar
          trades={dateFiltered}
          filters={filters}
          onChange={setFilters}
          showDateFields={false}
          mistakeOptions={mistakes.map((m) => m.name)}
        />
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No trades match your filters" />
      ) : (
        <>
          <ReportSummaryCard snapshot={reportSnapshot} />

          <div className="report-block">
            <h3>Long vs Short</h3>
            <div className="lvs-grid">
              <StatCard
                label={longStats.hasPnl ? "Long Net P&L" : "Long Net R"}
                value={longStats.hasPnl ? fmtUsd(longStats.netPnl) : fmtR(longStats.netR)}
                tone={
                  (longStats.hasPnl ? longStats.netPnl : longStats.netR) > 0
                    ? "pos"
                    : (longStats.hasPnl ? longStats.netPnl : longStats.netR) < 0
                    ? "neg"
                    : ""
                }
                sub={
                  longStats.hasPnl
                    ? `${longStats.count} trades · ${fmtR(longStats.netR)}`
                    : `${longStats.count} trades`
                }
              />
              <StatCard label="Long Win %" value={fmtPct(longStats.winRate)} />
              <StatCard
                label={shortStats.hasPnl ? "Short Net P&L" : "Short Net R"}
                value={shortStats.hasPnl ? fmtUsd(shortStats.netPnl) : fmtR(shortStats.netR)}
                tone={
                  (shortStats.hasPnl ? shortStats.netPnl : shortStats.netR) > 0
                    ? "pos"
                    : (shortStats.hasPnl ? shortStats.netPnl : shortStats.netR) < 0
                    ? "neg"
                    : ""
                }
                sub={
                  shortStats.hasPnl
                    ? `${shortStats.count} trades · ${fmtR(shortStats.netR)}`
                    : `${shortStats.count} trades`
                }
              />
              <StatCard label="Short Win %" value={fmtPct(shortStats.winRate)} />
            </div>
          </div>

          <div className="report-block">
            <h3>Trade excursions</h3>
            {!hasExcursionData ? (
              <div className="empty-state">
                No excursion data yet — fill in Max favorable R and Max adverse R when logging
                trades.
              </div>
            ) : (
              <>
                <div className="lvs-grid">
                  <StatCard
                    label="Avg Max Favorable R"
                    value={fmtR(excursions.avgMaxFavorableR)}
                    sub={`${excursions.countWithMfe} trades`}
                  />
                  <StatCard
                    label="Avg Max Adverse R"
                    value={fmtR(excursions.avgMaxAdverseR)}
                    sub={`${excursions.countWithMae} trades`}
                  />
                  <StatCard
                    label="Capture ratio"
                    value={fmtPct(excursions.captureRatio)}
                    sub="Realized R ÷ max favorable R"
                  />
                  <StatCard
                    label="Left on table"
                    value={fmtR(excursions.avgLeftOnTable)}
                    sub="Avg on winning trades"
                  />
                </div>
                <div className="table-wrap" style={{ marginTop: 16 }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Trades</th>
                        <th>Avg Realized R</th>
                        <th>Avg Max Fav R</th>
                        <th>Avg Max Adv R</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excursionSplits.map((row) => (
                        <tr key={row.key}>
                          <td>{row.key}</td>
                          <td className="mono">{row.count}</td>
                          <td>
                            <RCell value={row.avgRealizedR} />
                          </td>
                          <td>
                            <RCell value={row.avgMaxFavorableR} />
                          </td>
                          <td>
                            <RCell value={row.avgMaxAdverseR} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="report-block">
            <h3>Exit reason performance</h3>
            {!hasExitReasonData ? (
              <div className="empty-state">No exit reasons tagged yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Exit reason</th>
                      <th>Trades</th>
                      <th>Win %</th>
                      <th>Net R</th>
                      <th>Avg R</th>
                      <th>Avg Max Fav R</th>
                      <th>Avg Max Adv R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exitReasons.map((g) => (
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
                          <RCell value={g.avgMaxFavorableR} />
                        </td>
                        <td>
                          <RCell value={g.avgMaxAdverseR} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                      <th>Net $</th>
                      <th>Net R</th>
                      <th>Avg R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mistakeStats.map((g) => (
                      <tr key={g.key}>
                        <td>{g.key}</td>
                        <td className="mono">{g.count}</td>
                        <td className={`mono ${signClass(g.netPnl)}`}>
                          {g.hasPnl ? fmtUsd(g.netPnl) : <span className="faint">—</span>}
                        </td>
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
                    <th>Net $</th>
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
                      <td className={`mono ${signClass(g.netPnl)}`}>
                        {g.hasPnl ? fmtUsd(g.netPnl) : <span className="faint">—</span>}
                      </td>
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
            <h3>Session performance</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Trades</th>
                    <th>Win %</th>
                    <th>Net $</th>
                    <th>Net R</th>
                    <th>Avg R</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((g) => (
                    <tr key={g.key}>
                      <td>{g.key}</td>
                      <td className="mono">{g.count}</td>
                      <td className="mono">
                        {g.count ? fmtPct(g.winRate) : <span className="faint">—</span>}
                      </td>
                      <td className={`mono ${signClass(g.netPnl)}`}>
                        {g.count && g.hasPnl ? (
                          fmtUsd(g.netPnl)
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </td>
                      <td>
                        {g.count ? <RCell value={g.netR} /> : <span className="faint">—</span>}
                      </td>
                      <td>
                        {g.count ? (
                          <RCell value={g.expectancy} />
                        ) : (
                          <span className="faint">—</span>
                        )}
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
                    <th>Net $</th>
                    <th>Net R</th>
                    <th>Avg R</th>
                  </tr>
                </thead>
                <tbody>
                  {weekdays.map((g) => (
                    <tr key={g.key}>
                      <td>{g.key}</td>
                      <td className="mono">{g.count}</td>
                      <td className={`mono ${signClass(g.netPnl)}`}>
                        {g.hasPnl ? fmtUsd(g.netPnl) : <span className="faint">—</span>}
                      </td>
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
            <th>Net $</th>
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
              <td className={`mono ${signClass(g.netPnl)}`}>
                {g.hasPnl ? fmtUsd(g.netPnl) : <span className="faint">—</span>}
              </td>
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
