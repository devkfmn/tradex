import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import type { Review, Setup, Trade } from "../types";
import { listTrades } from "../services/trades";
import { listSetups } from "../services/setups";
import { listReviews } from "../services/reviews";

interface DataContextValue {
  trades: Trade[];
  setups: Setup[];
  reviews: Review[];
  loading: boolean;
  error: string | null;
  reloadTrades: () => Promise<void>;
  reloadSetups: () => Promise<void>;
  reloadReviews: () => Promise<void>;
  reloadAll: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [trades, setTrades] = useState<Trade[]>([]);
  const [setups, setSetups] = useState<Setup[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadTrades = useCallback(async () => {
    if (!uid) return;
    setTrades(await listTrades(uid));
  }, [uid]);

  const reloadSetups = useCallback(async () => {
    if (!uid) return;
    setSetups(await listSetups(uid));
  }, [uid]);

  const reloadReviews = useCallback(async () => {
    if (!uid) return;
    setReviews(await listReviews(uid));
  }, [uid]);

  const reloadAll = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const [t, s, r] = await Promise.all([
        listTrades(uid),
        listSetups(uid),
        listReviews(uid),
      ]);
      setTrades(t);
      setSetups(s);
      setReviews(r);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load data from Firestore."
      );
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setTrades([]);
      setSetups([]);
      setReviews([]);
      setLoading(false);
      return;
    }
    void reloadAll();
  }, [uid, reloadAll]);

  return (
    <DataContext.Provider
      value={{
        trades,
        setups,
        reviews,
        loading,
        error,
        reloadTrades,
        reloadSetups,
        reloadReviews,
        reloadAll,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
