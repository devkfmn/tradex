import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Eye, EyeOff, LogOut } from "lucide-react";
import { format, subDays } from "date-fns";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { todayDisplay } from "../lib/dates";
import { firebaseConfigStatus } from "../lib/firebase";
import { downloadCsv, tradesToCsv } from "../lib/csv";
import { fmtUsd } from "../lib/analytics";
import { fetchMexcClosedPositions, fetchMexcFuturesEquity } from "../lib/mexcClient";
import {
  clearMexcCredentials,
  getExchangeCredentials,
  saveMexcCredentials,
} from "../services/exchangeCredentials";
import { importMexcClosedPositions } from "../services/mexcImport";

export default function Settings() {
  const { user, logout } = useAuth();
  const { trades, reloadTrades } = useData();
  const config = firebaseConfigStatus();

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFromDate, setImportFromDate] = useState(() =>
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasStoredCreds, setHasStoredCreds] = useState(false);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(
    null
  );

  useEffect(() => {
    if (!user) {
      setLoadingCreds(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const creds = await getExchangeCredentials(user.uid);
        if (!active) return;
        if (creds.mexc) {
          setApiKey(creds.mexc.apiKey);
          setApiSecret(creds.mexc.apiSecret);
          setHasStoredCreds(true);
        }
      } catch {
        if (active) setError("Failed to load exchange credentials.");
      } finally {
        if (active) setLoadingCreds(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const exportAll = () => {
    const csv = tradesToCsv(trades);
    downloadCsv(`tradex-all-trades-${todayDisplay()}.csv`, csv);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await saveMexcCredentials(user.uid, { apiKey, apiSecret });
      setHasStoredCreds(true);
      setMessage("MEXC credentials saved.");
    } catch {
      setError("Failed to save credentials.");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const equity = await fetchMexcFuturesEquity(apiKey, apiSecret);
      setMessage(`Connected. Futures equity: ${fmtUsd(equity)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    if (!user) return;
    setRemoving(true);
    setError(null);
    setMessage(null);
    setImportSuccessCount(null);
    try {
      await clearMexcCredentials(user.uid);
      setApiKey("");
      setApiSecret("");
      setHasStoredCreds(false);
      setMessage("MEXC credentials removed.");
    } catch {
      setError("Failed to remove credentials.");
    } finally {
      setRemoving(false);
    }
  };

  const runImport = async () => {
    if (!user) return;
    setImporting(true);
    setError(null);
    setMessage(null);
    setImportSuccessCount(null);
    try {
      const positions = await fetchMexcClosedPositions(
        apiKey,
        apiSecret,
        importFromDate
      );
      if (!positions.length) {
        setMessage("No closed futures positions found for that date range.");
        return;
      }
      await importMexcClosedPositions(user.uid, positions);
      await reloadTrades();
      setImportSuccessCount(positions.length);
      setMessage(
        `Imported ${positions.length} closed position${positions.length === 1 ? "" : "s"} into review.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page section-stack">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      {!config.ok && (
        <div className="banner-warn">
          Firebase config incomplete. Missing: {config.missing.join(", ")}. Set
          these in <code>.env.local</code> (local) or your Vercel project
          environment variables.
        </div>
      )}

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 14 }}>Account</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="avatar"
              style={{ width: 48, height: 48 }}
            />
          ) : (
            <span
              className="avatar avatar-fallback"
              style={{ width: 48, height: 48, fontSize: 20 }}
            >
              {(user?.displayName || user?.email || "?").charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <div style={{ fontWeight: 600 }}>{user?.displayName || "Trader"}</div>
            <div className="muted">{user?.email}</div>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <button className="btn" onClick={() => logout()}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>

      <div className="card form-section">
        <h3 style={{ fontSize: 15, marginBottom: 6 }}>Exchanges</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Connect MEXC to pull futures equity into the calculator and import
          closed futures positions into your journal. Create an API key with{" "}
          <strong>View Account Details</strong> (balance) and{" "}
          <strong>View Order Details</strong> (import). Credentials are stored in
          your private Firestore and only used over HTTPS. Consider
          IP-whitelisting your deployment.
        </p>

        {loadingCreds ? (
          <p className="muted" style={{ margin: 0 }}>
            Loading credentials…
          </p>
        ) : (
          <div className="form-grid">
            <div>
              <label htmlFor="mexc-api-key">MEXC Access Key</label>
              <input
                id="mexc-api-key"
                type="text"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Access key"
              />
            </div>
            <div>
              <label htmlFor="mexc-api-secret">MEXC Secret Key</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="mexc-api-secret"
                  type={showSecret ? "text" : "password"}
                  autoComplete="off"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Secret key"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowSecret((v) => !v)}
                  aria-label={showSecret ? "Hide secret" : "Show secret"}
                >
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {message && (
          <p className="computed" style={{ color: "var(--green)", marginTop: 12 }}>
            {message}
          </p>
        )}
        {error && (
          <p className="computed" style={{ color: "var(--red)", marginTop: 12 }}>
            {error}
          </p>
        )}

        {!loadingCreds && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={saving || !apiKey.trim() || !apiSecret.trim()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={testConnection}
              disabled={testing || !apiKey.trim() || !apiSecret.trim()}
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            {hasStoredCreds && (
              <button
                type="button"
                className="btn"
                onClick={remove}
                disabled={removing}
              >
                {removing ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card form-section">
        <h3 style={{ fontSize: 15, marginBottom: 6 }}>Import closed positions</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Import closed MEXC futures positions from a start date. Trades are
          created in <strong>review</strong> status so you can add setup, risk,
          and journal notes before finalizing.
        </p>

        {!loadingCreds && (
          <>
            <div className="form-grid" style={{ maxWidth: 320 }}>
              <div>
                <label htmlFor="mexc-import-from">Import from date</label>
                <input
                  id="mexc-import-from"
                  type="date"
                  value={importFromDate}
                  onChange={(e) => setImportFromDate(e.target.value)}
                  disabled={!apiKey.trim() || !apiSecret.trim()}
                />
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={runImport}
                disabled={
                  importing ||
                  !apiKey.trim() ||
                  !apiSecret.trim() ||
                  !importFromDate
                }
              >
                {importing ? "Importing…" : "Import from MEXC"}
              </button>
              {importSuccessCount != null && importSuccessCount > 0 && (
                <Link to="/trades?status=review" className="btn">
                  Review imported trades
                </Link>
              )}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 6 }}>Export</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Download all {trades.length} trades as a CSV file.
        </p>
        <button className="btn" onClick={exportAll} disabled={!trades.length}>
          <Download size={16} /> Export trades CSV
        </button>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 6 }}>About</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Tradex is a minimal crypto trading journal. Data is stored privately in
          your own Firebase project and scoped to your account. R-based metrics
          help you find which setups make money, which mistakes cost the most, and
          whether your process is improving.
        </p>
        <div className="faint" style={{ fontSize: 12 }}>
          Version 0.1.0 · Firebase {config.ok ? "connected" : "not configured"}
        </div>
      </div>
    </div>
  );
}
