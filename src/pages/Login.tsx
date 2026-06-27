import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { firebaseConfigStatus } from "../lib/firebase";

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const config = firebaseConfigStatus();

  if (loading) return null;

  if (user) {
    const dest =
      (location.state as { from?: { pathname: string } } | null)?.from
        ?.pathname || "/dashboard";
    return <Navigate to={dest} replace />;
  }

  const handleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Sign-in failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="card login-card">
        <span className="login-logo">
          <TrendingUp size={26} />
        </span>
        <h1 className="login-title">Tradex</h1>
        <p className="login-sub">
          Your crypto trading journal. Track setups, mistakes, and R-based
          performance.
        </p>

        <button
          className="btn google-btn"
          onClick={handleSignIn}
          disabled={busy || !config.ok}
        >
          <GoogleIcon />
          {busy ? "Signing in..." : "Continue with Google"}
        </button>

        {error && <div className="login-error">{error}</div>}

        {!config.ok && (
          <div className="login-warn">
            Firebase is not configured. Missing env vars:{" "}
            {config.missing.join(", ")}. Copy <code>.env.example</code> to{" "}
            <code>.env.local</code> and fill in your Firebase web config.
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
