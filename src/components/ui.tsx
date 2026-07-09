import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { Result } from "../types";
import { signClass } from "../lib/analytics";

export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "pos" | "neg" | "";
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ""}`}>{value}</div>
      {sub != null && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function ResultBadge({ result }: { result: Result | null }) {
  if (!result) return <span className="muted">—</span>;
  const cls =
    result === "Win" ? "badge-win" : result === "Loss" ? "badge-loss" : "badge-be";
  return <span className={`badge ${cls}`}>{result}</span>;
}

export function ReviewBadge() {
  return <span className="badge badge-review">Review</span>;
}

export function RCell({ value, digits = 2 }: { value: number | null; digits?: number }) {
  if (value == null || !Number.isFinite(value))
    return <span className="muted mono">—</span>;
  return (
    <span className={`mono ${signClass(value)}`}>
      {value > 0 ? "+" : ""}
      {value.toFixed(digits)}R
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div style={{ fontWeight: 500, color: "var(--text)" }}>{title}</div>
      {hint && <div style={{ marginTop: 6 }}>{hint}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="muted" style={{ marginTop: 0 }}>
        {message}
      </p>
      <div className="modal-actions">
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
