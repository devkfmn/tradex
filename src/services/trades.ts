import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  deleteField,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytes,
} from "firebase/storage";
import { compareTradesByRecency } from "../lib/filters";
import { db, storage } from "../lib/firebase";
import type { Trade, TradeInput } from "../types";

function tradesCol(uid: string) {
  return collection(db, "users", uid, "trades");
}

function tsToMillis(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return null;
}

export function normalizeMistakes(data: Record<string, unknown>): string[] {
  if (Array.isArray(data.mistakes)) {
    const names = data.mistakes
      .filter((m): m is string => typeof m === "string" && m.trim().length > 0)
      .map((m) => m.trim());
    return [...new Set(names)];
  }
  const legacy = data.mistake;
  if (typeof legacy === "string" && legacy.trim()) return [legacy.trim()];
  return [];
}

function fromDoc(id: string, data: Record<string, unknown>): Trade {
  return {
    id,
    date: (data.date as string) ?? "",
    coin: (data.coin as string) ?? "",
    direction: (data.direction as Trade["direction"]) ?? "Long",
    setup: (data.setup as string) ?? "",
    riskPct: (data.riskPct as number) ?? null,
    riskUsd: (data.riskUsd as number) ?? null,
    pnl: (data.pnl as number) ?? null,
    realizedR: (data.realizedR as number) ?? null,
    grade: (data.grade as Trade["grade"]) ?? "",
    mistakes: normalizeMistakes(data),
    postNotes: (data.postNotes as string) ?? "",
    screenshotUrls: (data.screenshotUrls as string[]) ?? [],
    entry: (data.entry as number) ?? null,
    stop: (data.stop as number) ?? null,
    target: (data.target as number) ?? null,
    timeframe: (data.timeframe as string) ?? "",
    session: (data.session as Trade["session"]) ?? "",
    marketCondition: (data.marketCondition as Trade["marketCondition"]) ?? "",
    exitReason: (data.exitReason as Trade["exitReason"]) ?? "",
    plannedR: (data.plannedR as number) ?? null,
    maxFavorableR: (data.maxFavorableR as number) ?? null,
    maxAdverseR: (data.maxAdverseR as number) ?? null,
    thesis: (data.thesis as string) ?? "",
    status: (data.status as Trade["status"]) ?? "done",
    source: (data.source as Trade["source"]) ?? "manual",
    mexcPositionId: (data.mexcPositionId as string) ?? null,
    createdAt: tsToMillis(data.createdAt),
    updatedAt: tsToMillis(data.updatedAt),
  };
}

/** Firestore rejects `undefined`. Strip undefined keys before writing. */
function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export async function listTrades(uid: string): Promise<Trade[]> {
  const q = query(tradesCol(uid), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromDoc(d.id, d.data())).sort(compareTradesByRecency);
}

export async function getTrade(uid: string, id: string): Promise<Trade | null> {
  const snap = await getDoc(doc(db, "users", uid, "trades", id));
  if (!snap.exists()) return null;
  return fromDoc(snap.id, snap.data());
}

export async function addTrade(
  uid: string,
  input: TradeInput
): Promise<string> {
  const payload = clean({
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const docRef = await addDoc(tradesCol(uid), payload);
  return docRef.id;
}

export async function updateTrade(
  uid: string,
  id: string,
  input: Partial<TradeInput>
): Promise<void> {
  const payload = clean({ ...input, updatedAt: serverTimestamp() });
  await updateDoc(doc(db, "users", uid, "trades", id), payload);
}

const LEGACY_TRADE_FIELDS = {
  exit: deleteField(),
  didHitPlannedTp: deleteField(),
};

/** One-time cleanup: strip removed fields from every trade document. */
export async function removeLegacyTradeFields(uid: string): Promise<void> {
  const snap = await getDocs(tradesCol(uid));
  if (snap.empty) return;

  const batchSize = 500;
  for (let i = 0; i < snap.docs.length; i += batchSize) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + batchSize)) {
      batch.update(d.ref, LEGACY_TRADE_FIELDS);
    }
    await batch.commit();
  }
}

/** One-time migration: move legacy `mistake` string to `mistakes` array. */
export async function migrateMistakesToArray(uid: string): Promise<void> {
  const snap = await getDocs(tradesCol(uid));
  if (snap.empty) return;

  const batchSize = 500;
  for (let i = 0; i < snap.docs.length; i += batchSize) {
    const batch = writeBatch(db);
    let pending = 0;
    for (const d of snap.docs.slice(i, i + batchSize)) {
      const data = d.data();
      if (Array.isArray(data.mistakes)) continue;
      const legacy = data.mistake;
      const mistakes =
        typeof legacy === "string" && legacy.trim() ? [legacy.trim()] : [];
      batch.update(d.ref, {
        mistakes,
        mistake: deleteField(),
      });
      pending++;
    }
    if (pending > 0) await batch.commit();
  }
}

/** One-time migration: backfill createdAt on trades missing it. */
export async function migrateCreatedAtTimestamps(uid: string): Promise<void> {
  const snap = await getDocs(tradesCol(uid));
  if (snap.empty) return;

  const batchSize = 500;
  for (let i = 0; i < snap.docs.length; i += batchSize) {
    const batch = writeBatch(db);
    let pending = 0;
    for (const d of snap.docs.slice(i, i + batchSize)) {
      const data = d.data();
      if (data.createdAt != null) continue;
      const patch: Record<string, unknown> = {
        createdAt: data.updatedAt ?? serverTimestamp(),
      };
      if (data.updatedAt == null) {
        patch.updatedAt = serverTimestamp();
      }
      batch.update(d.ref, patch);
      pending++;
    }
    if (pending > 0) await batch.commit();
  }
}

export async function deleteTrade(uid: string, id: string): Promise<void> {
  // Best-effort: remove any uploaded screenshots in Storage first.
  try {
    const folder = ref(storage, `users/${uid}/trades/${id}`);
    const items = await listAll(folder);
    await Promise.all(items.items.map((item) => deleteObject(item)));
  } catch {
    // ignore storage cleanup errors (folder may not exist)
  }
  await deleteDoc(doc(db, "users", uid, "trades", id));
}

/** Upload screenshots for a trade and return their download URLs. */
export async function uploadScreenshots(
  uid: string,
  tradeId: string,
  files: File[]
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const safeName = `${Date.now()}_${file.name.replace(/[^\w.\-]/g, "_")}`;
    const fileRef = ref(storage, `users/${uid}/trades/${tradeId}/${safeName}`);
    await uploadBytes(fileRef, file);
    urls.push(await getDownloadURL(fileRef));
  }
  return urls;
}

/** Delete a single screenshot by its download URL. Best-effort. */
export async function deleteScreenshotByUrl(url: string): Promise<void> {
  try {
    await deleteObject(ref(storage, url));
  } catch {
    // file may already be gone
  }
}

/** Delete storage objects removed from a trade's screenshot list. */
export async function deleteRemovedScreenshots(
  previousUrls: string[],
  nextUrls: string[]
): Promise<void> {
  const removed = previousUrls.filter((u) => !nextUrls.includes(u));
  await Promise.all(removed.map((url) => deleteScreenshotByUrl(url)));
}
