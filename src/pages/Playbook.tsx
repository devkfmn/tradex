import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { addSetup, deleteSetup, updateSetup } from "../services/setups";
import { addMistake, deleteMistake, updateMistake } from "../services/mistakes";
import { computeStats, fmtPct, fmtR, fmtUsd } from "../lib/analytics";
import { ConfirmDialog, EmptyState, Modal } from "../components/ui";
import type { Mistake, MistakeInput, Setup, SetupInput } from "../types";

type Tab = "setups" | "mistakes";

const blankSetup: SetupInput = {
  name: "",
  rules: "",
  bestConditions: "",
  invalidConditions: "",
};

const blankMistake: MistakeInput = {
  name: "",
  description: "",
};

export default function Playbook() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() =>
    searchParams.get("tab") === "mistakes" ? "mistakes" : "setups"
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Playbook</h1>
          <p className="page-subtitle">
            Your setup and mistake libraries with live performance stats
          </p>
        </div>
      </div>

      <div className="tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "setups"}
          className={`tab-btn ${tab === "setups" ? "active" : ""}`}
          onClick={() => setTab("setups")}
        >
          Setups
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mistakes"}
          className={`tab-btn ${tab === "mistakes" ? "active" : ""}`}
          onClick={() => setTab("mistakes")}
        >
          Mistakes
        </button>
      </div>

      {tab === "setups" ? <SetupsTab /> : <MistakesTab />}
    </div>
  );
}

function SetupsTab() {
  const { user } = useAuth();
  const { trades, setups, loading, reloadSetups } = useData();

  const [editing, setEditing] = useState<Setup | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Setup | null>(null);

  const statsByName = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof computeStats> & { best: number | null; worst: number | null }
    >();
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
    <>
      <div className="tab-toolbar">
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
    </>
  );
}

function MistakesTab() {
  const { user } = useAuth();
  const { trades, mistakes, loading, reloadMistakes } = useData();

  const [editing, setEditing] = useState<Mistake | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Mistake | null>(null);

  const statsByName = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeStats>>();
    for (const m of mistakes) {
      const linked = trades.filter((t) =>
        t.mistakes.some(
          (tag) => tag.trim().toLowerCase() === m.name.trim().toLowerCase()
        )
      );
      map.set(m.name.toLowerCase(), computeStats(linked));
    }
    return map;
  }, [mistakes, trades]);

  const handleDelete = async () => {
    if (!user || !toDelete) return;
    await deleteMistake(user.uid, toDelete.id);
    await reloadMistakes();
    setToDelete(null);
  };

  return (
    <>
      <div className="tab-toolbar">
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> New Mistake
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : mistakes.length === 0 ? (
        <EmptyState
          title="No mistakes yet"
          hint="Define common mistakes so you can tag trades consistently and see which habits cost the most."
          action={
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> New Mistake
            </button>
          }
        />
      ) : (
        <div className="setup-grid">
          {mistakes.map((m) => {
            const st = statsByName.get(m.name.toLowerCase());
            return (
              <div className="card setup-card" key={m.id}>
                <h3>{m.name}</h3>
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
                </div>

                {m.description && (
                  <div className="setup-block">
                    <div className="k">Description</div>
                    <div className="v">{m.description}</div>
                  </div>
                )}

                <div className="card-actions">
                  <button className="btn btn-sm" onClick={() => setEditing(m)}>
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setToDelete(m)}
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
        <MistakeForm
          initial={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            await reloadMistakes();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete mistake"
          message={`Delete "${toDelete.name}"? Linked trades keep their mistake tags but lose this library entry.`}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
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
      : blankSetup
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

function MistakeForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Mistake;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<MistakeInput>(
    initial
      ? { name: initial.name, description: initial.description }
      : blankMistake
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<MistakeInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      if (initial) await updateMistake(user.uid, initial.id, form);
      else await addMistake(user.uid, form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mistake.");
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit mistake" : "New mistake"} onClose={onClose} wide>
      <form onSubmit={submit}>
        {error && <div className="banner-error" style={{ marginBottom: 14 }}>{error}</div>}
        <div className="form-grid">
          <div className="field-full">
            <label>Name *</label>
            <input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. FOMO"
            />
          </div>
          <div className="field-full">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="When does this mistake happen? How to avoid it?"
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
