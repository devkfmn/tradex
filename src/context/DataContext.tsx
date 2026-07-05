import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import type { Review, Setup, Trade, Mistake } from "../types";
import { listTrades, migrateMistakesToArray, removeLegacyTradeFields } from "../services/trades";
import { listSetups } from "../services/setups";
import { listReviews } from "../services/reviews";
import { listMistakes, seedDefaultMistakes, syncDefaultMistakes } from "../services/mistakes";

interface DataContextValue {
  trades: Trade[];
  setups: Setup[];
  mistakes: Mistake[];
  reviews: Review[];
  loading: boolean;
  error: string | null;
  reloadTrades: () => Promise<void>;
  reloadSetups: () => Promise<void>;
  reloadMistakes: () => Promise<void>;
  reloadReviews: () => Promise<void>;
  reloadAll: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

const LEGACY_FIELDS_MIGRATION_KEY = "tradex.migration.removedExitFields.v1";
const MISTAKES_SEED_MIGRATION_KEY = "tradex.migration.seedMistakes.v1";
const MISTAKES_SYNC_MIGRATION_KEY = "tradex.migration.syncMistakes.v2";
const MISTAKES_ARRAY_MIGRATION_KEY = "tradex.migration.mistakesArray.v1";

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [trades, setTrades] = useState<Trade[]>([]);
  const [setups, setSetups] = useState<Setup[]>([]);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
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

  const reloadMistakes = useCallback(async () => {
    if (!uid) return;
    setMistakes(await listMistakes(uid));
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
      const migrationKey = `${LEGACY_FIELDS_MIGRATION_KEY}.${uid}`;
      if (!localStorage.getItem(migrationKey)) {
        await removeLegacyTradeFields(uid);
        localStorage.setItem(migrationKey, "1");
      }
      const mistakesSeedKey = `${MISTAKES_SEED_MIGRATION_KEY}.${uid}`;
      if (!localStorage.getItem(mistakesSeedKey)) {
        await seedDefaultMistakes(uid);
        localStorage.setItem(mistakesSeedKey, "1");
      }
      const mistakesSyncKey = `${MISTAKES_SYNC_MIGRATION_KEY}.${uid}`;
      if (!localStorage.getItem(mistakesSyncKey)) {
        await syncDefaultMistakes(uid);
        localStorage.setItem(mistakesSyncKey, "1");
      }
      const mistakesArrayKey = `${MISTAKES_ARRAY_MIGRATION_KEY}.${uid}`;
      if (!localStorage.getItem(mistakesArrayKey)) {
        await migrateMistakesToArray(uid);
        localStorage.setItem(mistakesArrayKey, "1");
      }
      const [t, s, m, r] = await Promise.all([
        listTrades(uid),
        listSetups(uid),
        listMistakes(uid),
        listReviews(uid),
      ]);
      setTrades(t);
      setSetups(s);
      setMistakes(m);
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
      setMistakes([]);
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
        mistakes,
        reviews,
        loading,
        error,
        reloadTrades,
        reloadSetups,
        reloadMistakes,
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
