import type { Trade } from "../types";
import { fmtDate } from "./dates";
import { resultFromR } from "./analytics";

function esc(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const HEADERS = [
  "Date",
  "Coin",
  "Direction",
  "Result",
  "Setup",
  "Risk %",
  "Risk $",
  "PnL",
  "Realized R",
  "Grade",
  "Mistake",
  "Notes",
];

export function tradesToCsv(trades: Trade[]): string {
  const rows = trades.map((t) => [
    fmtDate(t.date),
    t.coin,
    t.direction,
    resultFromR(t.realizedR) ?? "",
    t.setup,
    t.riskPct ?? "",
    t.riskUsd ?? "",
    t.pnl ?? "",
    t.realizedR ?? "",
    t.grade,
    t.mistakes.join("; "),
    t.postNotes,
  ]);
  return [HEADERS, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
