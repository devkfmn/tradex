import { format } from "date-fns";
import { Download, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { firebaseConfigStatus } from "../lib/firebase";
import { downloadCsv, tradesToCsv } from "../lib/csv";

export default function Settings() {
  const { user, logout } = useAuth();
  const { trades } = useData();
  const config = firebaseConfigStatus();

  const exportAll = () => {
    const csv = tradesToCsv(trades);
    downloadCsv(`tradex-all-trades-${format(new Date(), "yyyy-MM-dd")}.csv`, csv);
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
