import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { addSetup, deleteSetup, updateSetup } from "../services/setups";
import { computeStats, fmtPct, fmtR, fmtUsd } from "../lib/analytics";
import { ConfirmDialog, EmptyState, Modal } from "../components/ui";
import type { Setup, SetupInput } from "../types";

const blank: SetupInput = {
  name: "",
  rules: "",
  bestConditions: "",
  invalidConditions: "",
};

export default function Playbook() {
  const { user } = useAuth();
  const { trades, setups, loading, reloadSetups } = useData();

  const [editing, setEditing] = useState<Setup | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Setup | null>(null);

  const statsByName = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeStats> & { best: number | null; worst: number | null }>();
    for (const s of setups) {
      const linked = trades.filter(
        (t) => t.setup.trim().toLowerCase() === s.name.trim().toLowerCase()
      );
      const stats = computeStats(linked);
      const rs = linked
        .map((t) => t.realizedR)
        .filter((r): r is number => r != null && Number.isFinite(r));
      map.set(s.name.toLowerCase(), {
        ...stats,
        best: rs.length ? Math.max(...rs) : null,
        worst: rs.length ? Math.min(...rs) : null,
      });
    }
    return map;
  }, [setups, trades]);

  const handleDelete = async () => {
    if (!user || !toDelete) return;
    await deleteSetup(user.uid, toDelete.id);
    await reloadSetups();
    setToDelete(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Playbook</h1>
          <p className="page-subtitle">Your setup library and how each performs</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> New Setup
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : setups.length === 0 ? (
        <EmptyState
          title="No setups yet"
          hint="Define your trading setups so you can track which ones actually make money."
          action={
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> New Setup
            </button>
          }
        />
      ) : (
        <div className="setup-grid">
          {setups.map((s) => {
            const st = statsByName.get(s.name.toLowerCase());
            return (
              <div className="card setup-card" key={s.id}>
                <h3>{s.name}</h3>
                <div className="setup-stat-row">
                  <div className="setup-stat">
                    <div className="k">Trades</div>
                    <div className="v">{st?.count ?? 0}</div>
                  </div>
                  <div className="setup-stat">
                    <div className="k">Win rate</div>
                    <div className="v">{fmtPct(st?.winRate ?? null)}</div>
                  </div>
                  <div className="setup-stat">
                    <div className="k">Net $</div>
                    <div className="v">{st?.hasPnl ? fmtUsd(st.netPnl) : "—"}</div>
                  </div>
                  <div className="setup-stat">
                    <div className="k">Net R</div>
                    <div className="v">{fmtR(st?.netR ?? 0)}</div>
                  </div>
                  <div className="setup-stat">
                    <div className="k">Expectancy</div>
                    <div className="v">{fmtR(st?.expectancy ?? null)}</div>
                  </div>
                  <div className="setup-stat">
                    <div className="k">Best</div>
                    <div className="v">{fmtR(st?.best ?? null)}</div>
                  </div>
                  <div className="setup-stat">
                    <div className="k">Worst</div>
                    <div className="v">{fmtR(st?.worst ?? null)}</div>
                  </div>
                </div>

                {s.rules && (
                  <div className="setup-block">
                    <div className="k">Rules</div>
                    <div className="v">{s.rules}</div>
                  </div>
                )}
                {s.bestConditions && (
                  <div className="setup-block">
                    <div className="k">Best conditions</div>
                    <div className="v">{s.bestConditions}</div>
                  </div>
                )}
                {s.invalidConditions && (
                  <div className="setup-block">
                    <div className="k">Invalid conditions</div>
                    <div className="v">{s.invalidConditions}</div>
                  </div>
                )}

                <div className="card-actions">
                  <button className="btn btn-sm" onClick={() => setEditing(s)}>
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setToDelete(s)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <SetupForm
          initial={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            await reloadSetups();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete setup"
          message={`Delete "${toDelete.name}"? Linked trades keep their setup label but lose this playbook entry.`}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

function SetupForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Setup;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<SetupInput>(
    initial
      ? {
          name: initial.name,
          rules: initial.rules,
          bestConditions: initial.bestConditions,
          invalidConditions: initial.invalidConditions,
        }
      : blank
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<SetupInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      if (initial) await updateSetup(user.uid, initial.id, form);
      else await addSetup(user.uid, form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save setup.");
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit setup" : "New setup"} onClose={onClose} wide>
      <form onSubmit={submit}>
        {error && <div className="banner-error" style={{ marginBottom: 14 }}>{error}</div>}
        <div className="form-grid">
          <div className="field-full">
            <label>Name *</label>
            <input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Liquidity sweep reversal"
            />
          </div>
          <div className="field-full">
            <label>Rules</label>
            <textarea
              value={form.rules}
              onChange={(e) => set({ rules: e.target.value })}
            />
          </div>
          <div className="field-full">
            <label>Best conditions</label>
            <textarea
              value={form.bestConditions}
              onChange={(e) => set({ bestConditions: e.target.value })}
            />
          </div>
          <div className="field-full">
            <label>Invalid conditions</label>
            <textarea
              value={form.invalidConditions}
              onChange={(e) => set({ invalidConditions: e.target.value })}
            />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
