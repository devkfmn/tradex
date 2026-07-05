import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { ExchangeCredentials, MexcCredentials } from "../types";

function exchangesDoc(uid: string) {
  return doc(db, "users", uid, "settings", "exchanges");
}

function tsToMillis(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return null;
}

function fromDoc(data: Record<string, unknown>): ExchangeCredentials {
  const mexcRaw = data.mexc as Record<string, unknown> | undefined;
  if (!mexcRaw) return {};

  const apiKey = mexcRaw.apiKey;
  const apiSecret = mexcRaw.apiSecret;
  if (typeof apiKey !== "string" || typeof apiSecret !== "string") return {};

  return {
    mexc: {
      apiKey,
      apiSecret,
      updatedAt: tsToMillis(mexcRaw.updatedAt),
    },
  };
}

export async function getExchangeCredentials(
  uid: string
): Promise<ExchangeCredentials> {
  const snap = await getDoc(exchangesDoc(uid));
  if (!snap.exists()) return {};
  return fromDoc(snap.data());
}

export async function saveMexcCredentials(
  uid: string,
  credentials: MexcCredentials
): Promise<void> {
  const ref = exchangesDoc(uid);
  const snap = await getDoc(ref);
  const payload = {
    mexc: {
      apiKey: credentials.apiKey.trim(),
      apiSecret: credentials.apiSecret.trim(),
      updatedAt: serverTimestamp(),
    },
  };
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }
}

export async function clearMexcCredentials(uid: string): Promise<void> {
  const ref = exchangesDoc(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { mexc: deleteField() });
}
