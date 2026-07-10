import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { snapshotCacheKey, type ReportSnapshot } from "../lib/reportSnapshot";
import {
  aiSummaryAvailable,
  generateReportSummary,
  type ReportSummaryResult,
} from "../services/reportSummary";

const MIN_TRADES = 3;

type Status = "idle" | "loading" | "success" | "error";

function formatSummaryError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Failed to generate summary";
  if (message.includes("prepayment credits are depleted")) {
    return "Gemini prepay credits are depleted for the AI Studio billing account linked to this project. Enable Vertex AI in Firebase AI Logic, or add credits for project tradex-bd79e at aistudio.google.com/billing.";
  }
  if (message.includes("api-not-enabled")) {
    return "Firebase AI Logic is not fully enabled. Open Firebase Console → AI Logic → Get started, then retry.";
  }
  return message.replace(/^AI:\s*/, "");
}

interface ReportSummaryCardProps {
  snapshot: ReportSnapshot;
}

export default function ReportSummaryCard({ snapshot }: ReportSummaryCardProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ReportSummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestId = useRef(0);

  const cacheKey = snapshotCacheKey(snapshot);
  const canGenerate = aiSummaryAvailable() && snapshot.tradeCount >= MIN_TRADES;

  useEffect(() => {
    if (!canGenerate) {
      setStatus("idle");
      setResult(null);
      setError(null);
      return;
    }

    const id = ++requestId.current;
    setStatus("loading");
    setError(null);

    generateReportSummary(snapshot)
      .then((summary) => {
        if (id !== requestId.current) return;
        setResult(summary);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(formatSummaryError(err));
        setStatus("error");
      });
  }, [cacheKey, refreshKey, canGenerate, snapshot]);

  if (!aiSummaryAvailable()) {
    return (
      <div className="report-summary-card">
        <p className="muted">
          AI summary unavailable — enable Firebase AI Logic with{" "}
          <code>npx firebase-tools init ailogic</code>.
        </p>
      </div>
    );
  }

  if (snapshot.tradeCount < MIN_TRADES) {
    return (
      <div className="report-summary-card">
        <div className="report-summary-header">
          <h3>
            Summary · {snapshot.rangeLabel} · {snapshot.tradeCount} trade
            {snapshot.tradeCount === 1 ? "" : "s"}
          </h3>
        </div>
        <p className="muted">Log a few more trades for a meaningful summary.</p>
      </div>
    );
  }

  return (
    <div className="report-summary-card">
      <div className="report-summary-header">
        <h3>
          Summary · {snapshot.rangeLabel} · {snapshot.tradeCount} trades
        </h3>
        <button
          type="button"
          className="btn btn-ghost report-summary-refresh"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={status === "loading"}
          aria-label="Refresh summary"
          title="Refresh summary"
        >
          <RotateCw size={16} className={status === "loading" ? "spin" : ""} />
        </button>
      </div>

      {status === "loading" && (
        <div className="report-summary-body">
          <div className="report-summary-skeleton" />
          <div className="report-summary-skeleton short" />
          <p className="muted report-summary-loading">Analyzing your trades…</p>
        </div>
      )}

      {status === "success" && result && (
        <div className="report-summary-body">
          <div className="report-summary-section">
            <h4>What&apos;s happening</h4>
            <p>{result.summary}</p>
          </div>
          {result.suggestions.length > 0 && (
            <div className="report-summary-section">
              <h4>Consider changing</h4>
              <ul>
                {result.suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="report-summary-body">
          <p className="muted">{error ?? "Could not generate summary."}</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
