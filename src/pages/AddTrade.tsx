import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import {
  addTrade,
  deleteRemovedScreenshots,
  getTrade,
  updateTrade,
  uploadScreenshots,
} from "../services/trades";
import {
  plannedR,
  realizedRFromPnl,
  resultFromR,
  fmtR,
} from "../lib/analytics";
import {
  DIRECTIONS,
  EXIT_REASONS,
  GRADES,
  MARKET_CONDITIONS,
  SESSIONS,
} from "../lib/constants";
import { ResultBadge } from "../components/ui";
import { canonicalName, canonicalNames } from "../lib/filters";
import type { Direction, Trade, TradeInput, TradePlanPrefill } from "../types";

type FormState = {
  date: string;
  coin: string;
  direction: Direction;
  setup: string;
  entry: string;
  stop: string;
  target: string;
  riskPct: string;
  riskUsd: string;
  timeframe: string;
  session: string;
  marketCondition: string;
  thesis: string;
  pnl: string;
  realizedR: string;
  grade: string;
  mistakes: string[];
  exitReason: string;
  maxFavorableR: string;
  maxAdverseR: string;
  postNotes: string;
};

const blankForm = (): FormState => ({
  date: format(new Date(), "yyyy-MM-dd"),
  coin: "",
  direction: "Long",
  setup: "",
  entry: "",
  stop: "",
  target: "",
  riskPct: "",
  riskUsd: "",
  timeframe: "",
  session: "",
  marketCondition: "",
  thesis: "",
  pnl: "",
  realizedR: "",
  grade: "",
  mistakes: [],
  exitReason: "",
  maxFavorableR: "",
  maxAdverseR: "",
  postNotes: "",
});

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fromTrade(t: Trade): FormState {
  const s = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n) ? "" : String(n);
  return {
    date: t.date,
    coin: t.coin,
    direction: t.direction,
    setup: t.setup,
    entry: s(t.entry),
    stop: s(t.stop),
    target: s(t.target),
    riskPct: s(t.riskPct),
    riskUsd: s(t.riskUsd),
    timeframe: t.timeframe ?? "",
    session: t.session ?? "",
    marketCondition: t.marketCondition ?? "",
    thesis: t.thesis ?? "",
    pnl: s(t.pnl),
    realizedR: s(t.realizedR),
    grade: t.grade ?? "",
    mistakes: [...(t.mistakes ?? [])],
    exitReason: t.exitReason ?? "",
    maxFavorableR: s(t.maxFavorableR),
    maxAdverseR: s(t.maxAdverseR),
    postNotes: t.postNotes ?? "",
  };
}

export default function AddTrade() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { setups, mistakes, reloadTrades } = useData();

  const [form, setForm] = useState<FormState>(() => {
    const base = blankForm();
    if (isEdit) return base;
    const prefill = location.state as TradePlanPrefill | null;
    if (!prefill) return base;
    return { ...base, ...prefill };
  });
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const [originalUrls, setOriginalUrls] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !user || !id) return;
    let active = true;
    (async () => {
      try {
        const t = await getTrade(user.uid, id);
        if (!active) return;
        if (!t) {
          setError("Trade not found.");
        } else {
          setForm(fromTrade(t));
          const urls = t.screenshotUrls ?? [];
          setExistingUrls(urls);
          setOriginalUrls(urls);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load trade.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isEdit, user, id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleMistake = (name: string) => {
    setForm((f) => {
      const key = name.toLowerCase();
      const selected = f.mistakes.some((m) => m.toLowerCase() === key);
      return {
        ...f,
        mistakes: selected
          ? f.mistakes.filter((m) => m.toLowerCase() !== key)
          : [...f.mistakes, name],
      };
    });
  };

  // derived values
  const derivedPlannedR = useMemo(
    () => plannedR(num(form.entry), num(form.stop), num(form.target), form.direction),
    [form.entry, form.stop, form.target, form.direction]
  );

  const derivedRealizedR = useMemo(
    () => realizedRFromPnl(num(form.pnl), num(form.riskUsd)),
    [form.pnl, form.riskUsd]
  );

  // effective realized R: manual override if typed, else derived
  const effectiveRealizedR = useMemo(() => {
    const manual = num(form.realizedR);
    if (manual != null) return manual;
    return derivedRealizedR;
  }, [form.realizedR, derivedRealizedR]);

  const result = resultFromR(effectiveRealizedR);

  const addFiles = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setPendingFiles((prev) => [...prev, ...images]);
  };

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    addFiles(Array.from(files));
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pasted: File[] = [];
      for (const item of Array.from(items)) {
        if (!item.type.startsWith("image/")) continue;
        const blob = item.getAsFile();
        if (!blob) continue;
        const ext = blob.type.split("/")[1] || "png";
        pasted.push(
          new File([blob], `pasted-${Date.now()}.${ext}`, { type: blob.type })
        );
      }
      if (pasted.length) {
        e.preventDefault();
        addFiles(pasted);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.coin.trim()) {
      setError("Coin is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const input: TradeInput = {
      date: form.date,
      coin: form.coin.trim().toUpperCase(),
      direction: form.direction,
      setup: canonicalName(form.setup, setups),
      riskPct: num(form.riskPct),
      riskUsd: num(form.riskUsd),
      pnl: num(form.pnl),
      realizedR: effectiveRealizedR,
      grade: (form.grade as Trade["grade"]) || "",
      mistakes: canonicalNames(form.mistakes, mistakes),
      postNotes: form.postNotes.trim(),
      screenshotUrls: existingUrls,
      entry: num(form.entry),
      stop: num(form.stop),
      target: num(form.target),
      timeframe: form.timeframe.trim(),
      session: (form.session as Trade["session"]) || "",
      marketCondition: (form.marketCondition as Trade["marketCondition"]) || "",
      exitReason: (form.exitReason as Trade["exitReason"]) || "",
      plannedR: derivedPlannedR,
      maxFavorableR: num(form.maxFavorableR),
      maxAdverseR: num(form.maxAdverseR),
      thesis: form.thesis.trim(),
    };

    try {
      let tradeId = id;
      let finalUrls = existingUrls;

      if (isEdit && id) {
        await updateTrade(user.uid, id, input);
      } else {
        tradeId = await addTrade(user.uid, input);
      }

      if (pendingFiles.length && tradeId) {
        const newUrls = await uploadScreenshots(user.uid, tradeId, pendingFiles);
        finalUrls = [...existingUrls, ...newUrls];
        await updateTrade(user.uid, tradeId, {
          screenshotUrls: finalUrls,
        });
      }

      if (isEdit && id) {
        await deleteRemovedScreenshots(originalUrls, finalUrls);
      }

      await reloadTrades();
      navigate("/trades");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save trade.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading trade…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEdit ? "Edit Trade" : "Add Trade"}</h1>
          <p className="page-subtitle">
            Plan the trade, then fill in the review after it closes.
          </p>
        </div>
      </div>

      {error && <div className="banner-error" style={{ marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* SECTION 1: PLAN */}
        <div className="card form-section">
          <div className="section-title">1 · Plan</div>
          <div className="form-grid">
            <div>
              <label>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
            <div>
              <label>Coin *</label>
              <input
                placeholder="BTC"
                value={form.coin}
                onChange={(e) => set("coin", e.target.value)}
              />
            </div>
            <div>
              <label>Direction</label>
              <select
                value={form.direction}
                onChange={(e) => set("direction", e.target.value as Direction)}
              >
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Setup</label>
              <input
                list="setup-options"
                placeholder="Type or pick a setup"
                value={form.setup}
                onChange={(e) => set("setup", e.target.value)}
              />
              <datalist id="setup-options">
                {setups.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label>Entry</label>
              <input
                type="number"
                step="any"
                value={form.entry}
                onChange={(e) => set("entry", e.target.value)}
              />
            </div>
            <div>
              <label>Stop</label>
              <input
                type="number"
                step="any"
                value={form.stop}
                onChange={(e) => set("stop", e.target.value)}
              />
            </div>
            <div>
              <label>Target</label>
              <input
                type="number"
                step="any"
                value={form.target}
                onChange={(e) => set("target", e.target.value)}
              />
              {derivedPlannedR != null && (
                <div className="computed">Planned {fmtR(derivedPlannedR)}</div>
              )}
            </div>
            <div>
              <label>Risk %</label>
              <input
                type="number"
                step="any"
                value={form.riskPct}
                onChange={(e) => set("riskPct", e.target.value)}
              />
            </div>
            <div>
              <label>Risk $</label>
              <input
                type="number"
                step="any"
                value={form.riskUsd}
                onChange={(e) => set("riskUsd", e.target.value)}
              />
            </div>
            <div>
              <label>Timeframe</label>
              <input
                placeholder="15m, 4h, 1D"
                value={form.timeframe}
                onChange={(e) => set("timeframe", e.target.value)}
              />
            </div>
            <div>
              <label>Session</label>
              <select
                value={form.session}
                onChange={(e) => set("session", e.target.value)}
              >
                <option value="">—</option>
                {SESSIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Market condition</label>
              <select
                value={form.marketCondition}
                onChange={(e) => set("marketCondition", e.target.value)}
              >
                <option value="">—</option>
                {MARKET_CONDITIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-full">
              <label>Thesis / notes</label>
              <textarea
                placeholder="Why are you taking this trade?"
                value={form.thesis}
                onChange={(e) => set("thesis", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: REVIEW */}
        <div className="card form-section">
          <div className="section-title">2 · Review</div>
          <div className="form-grid">
            <div>
              <label>PnL ($)</label>
              <input
                type="number"
                step="any"
                value={form.pnl}
                onChange={(e) => set("pnl", e.target.value)}
              />
            </div>
            <div>
              <label>Realized R</label>
              <input
                type="number"
                step="any"
                placeholder={
                  derivedRealizedR != null
                    ? `auto: ${derivedRealizedR.toFixed(2)}`
                    : "manual"
                }
                value={form.realizedR}
                onChange={(e) => set("realizedR", e.target.value)}
              />
              {form.realizedR.trim() === "" && derivedRealizedR != null && (
                <div className="computed">
                  Using auto {fmtR(derivedRealizedR)} (from PnL / Risk $)
                </div>
              )}
            </div>
            <div>
              <label>Result</label>
              <div style={{ paddingTop: 6 }}>
                <ResultBadge result={result} />
              </div>
            </div>
            <div>
              <label>Grade</label>
              <select
                value={form.grade}
                onChange={(e) => set("grade", e.target.value)}
              >
                <option value="">—</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-full">
              <label>Mistake tags</label>
              <p className="field-hint">
                Select from your mistake library.{" "}
                <Link className="inline-link" to="/playbook?tab=mistakes">
                  Manage mistakes in Playbook
                </Link>
              </p>
              {mistakes.length === 0 &&
              !form.mistakes.some(
                (tag) =>
                  !mistakes.some(
                    (m) => m.name.toLowerCase() === tag.toLowerCase()
                  )
              ) ? (
                <p className="field-hint">
                  No mistake tags yet.{" "}
                  <Link className="inline-link" to="/playbook?tab=mistakes">
                    Add them in Playbook
                  </Link>
                </p>
              ) : (
                <div className="tag-chip-row">
                  {mistakes.map((m) => {
                    const selected = form.mistakes.some(
                      (tag) => tag.toLowerCase() === m.name.toLowerCase()
                    );
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`tag-chip${selected ? " selected" : ""}`}
                        onClick={() => toggleMistake(m.name)}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                  {form.mistakes
                    .filter(
                      (tag) =>
                        !mistakes.some(
                          (m) => m.name.toLowerCase() === tag.toLowerCase()
                        )
                    )
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="tag-chip selected"
                        onClick={() => toggleMistake(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div>
              <label>Exit reason</label>
              <select
                value={form.exitReason}
                onChange={(e) => set("exitReason", e.target.value)}
              >
                <option value="">—</option>
                {EXIT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Max favorable R</label>
              <input
                type="number"
                step="any"
                value={form.maxFavorableR}
                onChange={(e) => set("maxFavorableR", e.target.value)}
              />
            </div>
            <div>
              <label>Max adverse R</label>
              <input
                type="number"
                step="any"
                value={form.maxAdverseR}
                onChange={(e) => set("maxAdverseR", e.target.value)}
              />
            </div>
            <div className="field-full">
              <label>Post notes</label>
              <textarea
                placeholder="What happened? What did you learn?"
                value={form.postNotes}
                onChange={(e) => set("postNotes", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SCREENSHOTS */}
        <div className="card form-section">
          <div className="section-title">Screenshots</div>
          <div className="thumb-row" style={{ marginBottom: 14 }}>
            {existingUrls.map((url) => (
              <div className="thumb" key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt="screenshot" />
                </a>
                <button
                  type="button"
                  className="thumb-remove"
                  onClick={() =>
                    setExistingUrls((u) => u.filter((x) => x !== url))
                  }
                  aria-label="Remove"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {pendingFiles.map((file, i) => (
              <div className="thumb" key={`${file.name}-${i}`}>
                <img src={URL.createObjectURL(file)} alt={file.name} />
                <button
                  type="button"
                  className="thumb-remove"
                  onClick={() =>
                    setPendingFiles((f) => f.filter((_, idx) => idx !== i))
                  }
                  aria-label="Remove"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {existingUrls.length === 0 && pendingFiles.length === 0 && (
              <span className="muted">No screenshots yet.</span>
            )}
          </div>
          <div
            className={`dropzone${dragging ? " dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="dropzone-hint">
              Drag &amp; drop images here, paste (Ctrl+V), or use the picker.
            </div>
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
            Add before/after charts. Files upload when you save.
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => navigate(-1)}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving
              ? "Saving…"
              : isEdit
              ? "Save changes"
              : "Add trade"}
          </button>
        </div>
      </form>
    </div>
  );
}
