import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytes,
} from "firebase/storage";
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
    mistake: (data.mistake as string) ?? "",
    postNotes: (data.postNotes as string) ?? "",
    screenshotUrls: (data.screenshotUrls as string[]) ?? [],
    entry: (data.entry as number) ?? null,
    stop: (data.stop as number) ?? null,
    target: (data.target as number) ?? null,
    exit: (data.exit as number) ?? null,
    timeframe: (data.timeframe as string) ?? "",
    session: (data.session as Trade["session"]) ?? "",
    marketCondition: (data.marketCondition as Trade["marketCondition"]) ?? "",
    exitReason: (data.exitReason as Trade["exitReason"]) ?? "",
    plannedR: (data.plannedR as number) ?? null,
    maxFavorableR: (data.maxFavorableR as number) ?? null,
    maxAdverseR: (data.maxAdverseR as number) ?? null,
    didHitPlannedTp: (data.didHitPlannedTp as boolean) ?? null,
    thesis: (data.thesis as string) ?? "",
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
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
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
