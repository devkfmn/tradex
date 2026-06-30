import { useMemo, useState } from "react";
import { format, startOfWeek } from "date-fns";
import { Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { addReview, deleteReview } from "../services/reviews";
import { computeStats, fmtPct, fmtR, fmtUsd, groupStats } from "../lib/analytics";
import { StatCard, ConfirmDialog, EmptyState } from "../components/ui";
import type { Review as ReviewType, ReviewInput, RuleFollowed } from "../types";

function mondayOf(d: Date): string {
  return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export default function Review() {
  const { user } = useAuth();
  const { trades, reviews, loading, reloadReviews } = useData();

  const [weekStart, setWeekStart] = useState<string>(mondayOf(new Date()));
  const [form, setForm] = useState({
    bestSetup: "",
    worstSetup: "",
    mainMistake: "",
    bestTrade: "",
    worstTrade: "",
    ruleFollowed: "" as RuleFollowed | "",
    decisionNextWeek: "",
  });
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ReviewType | null>(null);

  // trades within the selected week [weekStart, weekStart+7)
  const weekTrades = useMemo(() => {
    const start = weekStart;
    const startDate = new Date(weekStart + "T00:00:00");
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    const end = format(endDate, "yyyy-MM-dd");
    return trades.filter((t) => t.date >= start && t.date < end);
  }, [trades, weekStart]);

  const weekStats = useMemo(() => computeStats(weekTrades), [weekTrades]);
  const suggestions = useMemo(() => {
    const setupGroups = groupStats(weekTrades, (t) => t.setup, {
      emptyLabel: "No setup",
    }).filter((g) => g.count > 0);
    const best = [...setupGroups].sort((a, b) => b.netR - a.netR)[0];
    const worst = [...setupGroups].sort((a, b) => a.netR - b.netR)[0];
    return { best: best?.key ?? "", worst: worst?.key ?? "" };
  }, [weekTrades]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const input: ReviewInput = {
      weekStartDate: weekStart,
      totalR: weekStats.netR,
      bestSetup: form.bestSetup.trim() || suggestions.best,
      worstSetup: form.worstSetup.trim() || suggestions.worst,
      mainMistake: form.mainMistake.trim(),
      bestTrade: form.bestTrade.trim(),
      worstTrade: form.worstTrade.trim(),
      ruleFollowed: form.ruleFollowed,
      decisionNextWeek: form.decisionNextWeek.trim(),
    };
    try {
      await addReview(user.uid, input);
      await reloadReviews();
      setForm({
        bestSetup: "",
        worstSetup: "",
        mainMistake: "",
        bestTrade: "",
        worstTrade: "",
        ruleFollowed: "",
        decisionNextWeek: "",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !toDelete) return;
    await deleteReview(user.uid, toDelete.id);
    await reloadReviews();
    setToDelete(null);
  };

  return (
    <div className="page section-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Review</h1>
          <p className="page-subtitle">Reflect on the week and plan the next</p>
        </div>
      </div>

      <div className="card">
        <div style={{ maxWidth: 220, marginBottom: 16 }}>
          <label>Week starting (Monday)</label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) =>
              setWeekStart(mondayOf(new Date(e.target.value + "T00:00:00")))
            }
          />
        </div>

        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <StatCard
            label={weekStats.hasPnl ? "Week Net P&L" : "Week Net R"}
            value={weekStats.hasPnl ? fmtUsd(weekStats.netPnl) : fmtR(weekStats.netR)}
            sub={weekStats.hasPnl ? `${fmtR(weekStats.netR)} net` : undefined}
            tone={
              (weekStats.hasPnl ? weekStats.netPnl : weekStats.netR) > 0
                ? "pos"
                : (weekStats.hasPnl ? weekStats.netPnl : weekStats.netR) < 0
                ? "neg"
                : ""
            }
          />
          <StatCard label="Trades" value={weekStats.count} />
          <StatCard label="Win rate" value={fmtPct(weekStats.winRate)} />
          <StatCard label="Expectancy" value={fmtR(weekStats.expectancy)} />
        </div>

        <form onSubmit={submit}>
          <div className="form-grid">
            <div>
              <label>Best setup {suggestions.best && <span className="faint">(auto: {suggestions.best})</span>}</label>
              <input
                value={form.bestSetup}
                onChange={(e) => set({ bestSetup: e.target.value })}
                placeholder={suggestions.best || "—"}
              />
            </div>
            <div>
              <label>Worst setup {suggestions.worst && <span className="faint">(auto: {suggestions.worst})</span>}</label>
              <input
                value={form.worstSetup}
                onChange={(e) => set({ worstSetup: e.target.value })}
                placeholder={suggestions.worst || "—"}
              />
            </div>
            <div>
              <label>Main mistake</label>
              <input
                value={form.mainMistake}
                onChange={(e) => set({ mainMistake: e.target.value })}
              />
            </div>
            <div>
              <label>Best trade</label>
              <input
                value={form.bestTrade}
                onChange={(e) => set({ bestTrade: e.target.value })}
              />
            </div>
            <div>
              <label>Worst trade</label>
              <input
                value={form.worstTrade}
                onChange={(e) => set({ worstTrade: e.target.value })}
              />
            </div>
            <div>
              <label>Did you follow your rules?</label>
              <select
                value={form.ruleFollowed}
                onChange={(e) =>
                  set({ ruleFollowed: e.target.value as RuleFollowed | "" })
                }
              >
                <option value="">—</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
            <div className="field-full">
              <label>Decision / focus for next week</label>
              <textarea
                value={form.decisionNextWeek}
                onChange={(e) => set({ decisionNextWeek: e.target.value })}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save review"}
            </button>
          </div>
        </form>
      </div>

      <div className="report-block">
        <h3>Previous reviews</h3>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : reviews.length === 0 ? (
          <EmptyState title="No reviews yet" hint="Save your first weekly review above." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Week of</th>
                  <th>Total R</th>
                  <th>Best setup</th>
                  <th>Worst setup</th>
                  <th>Main mistake</th>
                  <th>Rules</th>
                  <th>Next week</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.weekStartDate}</td>
                    <td>{fmtR(r.totalR)}</td>
                    <td>{r.bestSetup || <span className="faint">—</span>}</td>
                    <td>{r.worstSetup || <span className="faint">—</span>}</td>
                    <td>{r.mainMistake || <span className="faint">—</span>}</td>
                    <td>{r.ruleFollowed || <span className="faint">—</span>}</td>
                    <td
                      style={{ maxWidth: 240, whiteSpace: "normal" }}
                      title={r.decisionNextWeek}
                    >
                      {r.decisionNextWeek || <span className="faint">—</span>}
                    </td>
                    <td>
                      <button
                        className="icon-btn danger"
                        onClick={() => setToDelete(r)}
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Delete review"
          message={`Delete the review for week of ${toDelete.weekStartDate}?`}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
