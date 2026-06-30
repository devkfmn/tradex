import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
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
import { deleteTrade } from "../services/trades";
import { fmtUsd, resultFromR, signClass } from "../lib/analytics";
import { applyFilters, emptyFilters, type TradeFilters } from "../lib/filters";
import { downloadCsv, tradesToCsv } from "../lib/csv";
import FilterBar from "../components/FilterBar";
import { ConfirmDialog, EmptyState, ResultBadge, RCell } from "../components/ui";
import type { Trade } from "../types";

type SortKey = "date" | "coin" | "realizedR" | "pnl";
type SortDir = "asc" | "desc";

export default function Trades() {
  const { user } = useAuth();
  const { trades, loading, reloadTrades } = useData();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<TradeFilters>(emptyFilters);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [toDelete, setToDelete] = useState<Trade | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const rows = applyFilters(trades, filters);
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "coin") cmp = a.coin.localeCompare(b.coin);
      else if (sortKey === "realizedR")
        cmp = (a.realizedR ?? -Infinity) - (b.realizedR ?? -Infinity);
      else if (sortKey === "pnl") cmp = (a.pnl ?? -Infinity) - (b.pnl ?? -Infinity);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [trades, filters, sortKey, sortDir]);

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
    downloadCsv(`tradex-trades-${format(new Date(), "yyyy-MM-dd")}.csv`, csv);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trades</h1>
          <p className="page-subtitle">
            {filtered.length} of {trades.length} trades
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

      <FilterBar trades={trades} filters={filters} onChange={setFilters} />

      <div className="toolbar">
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setFilters(emptyFilters)}
        >
          <RotateCcw size={14} /> Reset filters
        </button>
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
                  <td className="mono">{t.date}</td>
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
                    {t.mistake ? (
                      <span className="tag">{t.mistake}</span>
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
          message={`Delete the ${toDelete.coin} trade from ${toDelete.date}? This also removes its screenshots and cannot be undone.`}
          onConfirm={busy ? () => {} : handleDelete}
          onCancel={() => (busy ? null : setToDelete(null))}
        />
      )}
    </div>
  );
}
