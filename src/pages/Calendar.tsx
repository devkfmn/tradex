import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useData } from "../context/DataContext";
import { fmtUsd, resultFromR, signClass } from "../lib/analytics";
import { ResultBadge, RCell } from "../components/ui";
import type { Trade } from "../types";

interface DayAgg {
  netR: number;
  netPnl: number;
  count: number;
  hasR: boolean;
  hasPnl: boolean;
}

export default function Calendar() {
  const { trades, loading } = useData();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, DayAgg>();
    for (const t of trades) {
      const key = t.date;
      const agg =
        map.get(key) ??
        { netR: 0, netPnl: 0, count: 0, hasR: false, hasPnl: false };
      agg.count += 1;
      if (t.realizedR != null && Number.isFinite(t.realizedR)) {
        agg.netR += t.realizedR;
        agg.hasR = true;
      }
      if (t.pnl != null && Number.isFinite(t.pnl)) {
        agg.netPnl += t.pnl;
        agg.hasPnl = true;
      }
      map.set(key, agg);
    }
    return map;
  }, [trades]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const selectedTrades = useMemo<Trade[]>(
    () => (selected ? trades.filter((t) => t.date === selected) : []),
    [selected, trades]
  );

  const monthNetR = useMemo(() => {
    let sum = 0;
    for (const [date, agg] of byDate) {
      const d = new Date(date + "T00:00:00");
      if (isSameMonth(d, month)) sum += agg.netR;
    }
    return sum;
  }, [byDate, month]);

  const monthNetPnl = useMemo(() => {
    let sum = 0;
    let any = false;
    for (const [date, agg] of byDate) {
      const d = new Date(date + "T00:00:00");
      if (isSameMonth(d, month) && agg.hasPnl) {
        sum += agg.netPnl;
        any = true;
      }
    }
    return any ? sum : null;
  }, [byDate, month]);

  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">Daily P&amp;L and Net R at a glance</p>
        </div>
      </div>

      <div className="cal-header">
        <button className="btn btn-sm" onClick={() => setMonth((m) => subMonths(m, 1))}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600 }}>{format(month, "MMMM yyyy")}</div>
          {monthNetPnl != null ? (
            <>
              <div
                className={`mono ${signClass(monthNetPnl)}`}
                style={{ fontSize: 15, fontWeight: 600 }}
              >
                {fmtUsd(monthNetPnl)} this month
              </div>
              <div className={`mono ${signClass(monthNetR)}`} style={{ fontSize: 12 }}>
                {monthNetR > 0 ? "+" : ""}
                {monthNetR.toFixed(2)}R
              </div>
            </>
          ) : (
            <div className={`mono ${signClass(monthNetR)}`} style={{ fontSize: 13 }}>
              {monthNetR > 0 ? "+" : ""}
              {monthNetR.toFixed(2)}R this month
            </div>
          )}
        </div>
        <button className="btn btn-sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight size={16} />
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="cal-grid" style={{ marginBottom: 6 }}>
            {dow.map((d) => (
              <div className="cal-dow" key={d}>
                {d}
              </div>
            ))}
          </div>
          <div className="cal-grid">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const agg = byDate.get(key);
              const inMonth = isSameMonth(day, month);
              const today = isSameDay(day, new Date());
              let toneClass = "";
              if (agg && agg.hasR) {
                if (agg.netR > 0.1) toneClass = "pos-day";
                else if (agg.netR < -0.1) toneClass = "neg-day";
                else toneClass = "flat-day";
              } else if (agg) {
                toneClass = "flat-day";
              }
              return (
                <button
                  key={key}
                  className={[
                    "cal-cell",
                    inMonth ? "" : "empty",
                    agg ? "has-trades" : "",
                    toneClass,
                    today ? "cal-today" : "",
                    selected === key ? "selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={!agg}
                  onClick={() => agg && setSelected(key)}
                >
                  {inMonth && (
                    <>
                      <span className="cal-date">{format(day, "d")}</span>
                      {agg && (
                        <>
                          {agg.hasPnl ? (
                            <span className={`cal-usd ${signClass(agg.netPnl)}`}>
                              {fmtUsd(agg.netPnl)}
                            </span>
                          ) : (
                            <span className={`cal-usd ${signClass(agg.netR)}`}>
                              {agg.hasR
                                ? `${agg.netR > 0 ? "+" : ""}${agg.netR.toFixed(2)}R`
                                : "—"}
                            </span>
                          )}
                          {agg.hasPnl && agg.hasR && (
                            <span className={`cal-r ${signClass(agg.netR)}`}>
                              {agg.netR > 0 ? "+" : ""}
                              {agg.netR.toFixed(2)}R
                            </span>
                          )}
                          <span className="cal-count">
                            {agg.count} trade{agg.count === 1 ? "" : "s"}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="card" style={{ marginTop: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h3 style={{ fontSize: 15 }}>
                  {format(new Date(selected + "T00:00:00"), "EEEE, dd-MM-yyyy")}
                </h3>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Coin</th>
                      <th>Dir</th>
                      <th>Setup</th>
                      <th>Result</th>
                      <th>PnL</th>
                      <th>R</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTrades.map((t) => (
                      <tr key={t.id}>
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
                        <td>{t.setup || <span className="faint">—</span>}</td>
                        <td>
                          <ResultBadge result={resultFromR(t.realizedR)} />
                        </td>
                        <td className={`mono ${signClass(t.pnl)}`}>
                          {fmtUsd(t.pnl)}
                        </td>
                        <td>
                          <RCell value={t.realizedR ?? null} />
                        </td>
                        <td>
                          <Link className="inline-link" to={`/trades/${t.id}/edit`}>
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
