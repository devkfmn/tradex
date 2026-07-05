import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fmtDate, formatDateRangeLabel, todayDisplay } from "../lib/dates";
import {
  Download,
  Pencil,
  Plus,
  Trash2,
  ImageIcon,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import DateRangeBar, {
  loadDatePreset,
  saveDatePreset,
  type DatePreset,
} from "../components/DateRangeBar";
import { deleteTrade } from "../services/trades";
import { fmtUsd, resultFromR, signClass } from "../lib/analytics";
import {
  applyFilters,
  compareTradesByRecency,
  emptyFilters,
  filterTradesByDateRange,
  presetToDateRange,
  type TradeFilters,
} from "../lib/filters";
import { downloadCsv, tradesToCsv } from "../lib/csv";
import FilterBar from "../components/FilterBar";
import { ConfirmDialog, EmptyState, ResultBadge, RCell } from "../components/ui";
import type { Trade } from "../types";

type SortKey = "date" | "coin" | "realizedR" | "pnl";
type SortDir = "asc" | "desc";

export default function Trades() {
  const { user } = useAuth();
  const { trades, mistakes, loading, reloadTrades } = useData();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<TradeFilters>(emptyFilters);
  const [preset, setPreset] = useState<DatePreset>(() => loadDatePreset());
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [toDelete, setToDelete] = useState<Trade | null>(null);
  const [busy, setBusy] = useState(false);

  const { from, to } = useMemo(() => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    return presetToDateRange(preset);
  }, [preset, customFrom, customTo]);

  const dateFiltered = useMemo(
    () => filterTradesByDateRange(trades, from, to),
    [trades, from, to]
  );

  const filtered = useMemo(() => {
    const rows = applyFilters(dateFiltered, filters);
    const sorted = [...rows].sort((a, b) => {
      if (sortKey === "date") {
        const cmp = compareTradesByRecency(a, b);
        return sortDir === "desc" ? cmp : -cmp;
      }
      let cmp = 0;
      if (sortKey === "coin") cmp = a.coin.localeCompare(b.coin);
      else if (sortKey === "realizedR")
        cmp = (a.realizedR ?? -Infinity) - (b.realizedR ?? -Infinity);
      else if (sortKey === "pnl") cmp = (a.pnl ?? -Infinity) - (b.pnl ?? -Infinity);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [dateFiltered, filters, sortKey, sortDir]);

  const rangeLabel = useMemo(
    () => formatDateRangeLabel(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const handlePresetChange = (next: DatePreset) => {
    setPreset(next);
    saveDatePreset(next);
  };

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "coin" ? "asc" : "desc");
    }
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const handleDelete = async () => {
    if (!user || !toDelete) return;
    setBusy(true);
    try {
      await deleteTrade(user.uid, toDelete.id);
      await reloadTrades();
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const csv = tradesToCsv(filtered);
    downloadCsv(`tradex-trades-${todayDisplay()}.csv`, csv);
  };

  return (
    <div className="page section-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trades</h1>
          <p className="page-subtitle">
            {rangeLabel} · {filtered.length} of {trades.length} trades
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={exportCsv} disabled={!filtered.length}>
            <Download size={16} /> Export CSV
          </button>
          <Link to="/trades/new" className="btn btn-primary">
            <Plus size={16} /> Add Trade
          </Link>
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

        <div className="toolbar">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setFilters(emptyFilters)}
          >
            <RotateCcw size={14} /> Reset filters
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading trades…</p>
      ) : trades.length === 0 ? (
        <EmptyState
          title="No trades yet"
          hint="Add your first trade to start building your journal."
          action={
            <Link to="/trades/new" className="btn btn-primary">
              <Plus size={16} /> Add Trade
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No trades match your filters" />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort("date")}>
                  Date{sortIndicator("date")}
                </th>
                <th className="sortable" onClick={() => toggleSort("coin")}>
                  Coin{sortIndicator("coin")}
                </th>
                <th>Dir</th>
                <th>Result</th>
                <th>Setup</th>
                <th>Risk %</th>
                <th>Risk $</th>
                <th className="sortable" onClick={() => toggleSort("pnl")}>
                  PnL{sortIndicator("pnl")}
                </th>
                <th className="sortable" onClick={() => toggleSort("realizedR")}>
                  R{sortIndicator("realizedR")}
                </th>
                <th>Grade</th>
                <th>Mistake</th>
                <th>Notes</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/trades/${t.id}/edit`)}
                  style={{ cursor: "pointer" }}
                >
                  <td className="mono">{fmtDate(t.date)}</td>
                  <td>{t.coin}</td>
                  <td>
                    <span
                      className={
                        t.direction === "Long" ? "badge-long" : "badge-short"
                      }
                    >
                      {t.direction}
                    </span>
                  </td>
                  <td>
                    <ResultBadge result={resultFromR(t.realizedR)} />
                  </td>
                  <td>{t.setup || <span className="faint">—</span>}</td>
                  <td className="mono">{t.riskPct != null ? `${t.riskPct}%` : "—"}</td>
                  <td className="mono">{fmtUsd(t.riskUsd)}</td>
                  <td className={`mono ${signClass(t.pnl)}`}>
                    {fmtUsd(t.pnl)}
                  </td>
                  <td>
                    <RCell value={t.realizedR ?? null} />
                  </td>
                  <td>{t.grade || <span className="faint">—</span>}</td>
                  <td>
                    {t.mistakes.length ? (
                      <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
                        {t.mistakes.map((m) => (
                          <span key={m} className="tag">
                            {m}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td
                    style={{
                      maxWidth: 220,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={t.postNotes}
                  >
                    {t.postNotes || <span className="faint">—</span>}
                  </td>
                  <td>
                    {t.screenshotUrls?.length ? (
                      <span
                        className="muted"
                        style={{ display: "inline-flex", gap: 3, alignItems: "center" }}
                      >
                        <ImageIcon size={14} />
                        {t.screenshotUrls.length}
                      </span>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 2 }}>
                      <Link
                        to={`/trades/${t.id}/edit`}
                        className="icon-btn"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </Link>
                      <button
                        className="icon-btn danger"
                        title="Delete"
                        onClick={() => setToDelete(t)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete trade"
          message={`Delete the ${toDelete.coin} trade from ${fmtDate(toDelete.date)}? This also removes its screenshots and cannot be undone.`}
          onConfirm={busy ? () => {} : handleDelete}
          onCancel={() => (busy ? null : setToDelete(null))}
        />
      )}
    </div>
  );
}
