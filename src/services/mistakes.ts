import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { DEFAULT_MISTAKES } from "../lib/constants";
import type { Mistake, MistakeInput } from "../types";

function mistakesCol(uid: string) {
  return collection(db, "users", uid, "mistakes");
}

function tsToMillis(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return null;
}

function fromDoc(id: string, data: Record<string, unknown>): Mistake {
  return {
    id,
    name: (data.name as string) ?? "",
    description: (data.description as string) ?? "",
    createdAt: tsToMillis(data.createdAt),
    updatedAt: tsToMillis(data.updatedAt),
  };
}

export async function listMistakes(uid: string): Promise<Mistake[]> {
  const q = query(mistakesCol(uid), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function addMistake(uid: string, input: MistakeInput): Promise<string> {
  const docRef = await addDoc(mistakesCol(uid), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateMistake(
  uid: string,
  id: string,
  input: Partial<MistakeInput>
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "mistakes", id), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMistake(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "mistakes", id));
}

/** Seed default mistakes when the collection is empty. */
export async function seedDefaultMistakes(uid: string): Promise<void> {
  const snap = await getDocs(mistakesCol(uid));
  if (!snap.empty) return;

  const batch = writeBatch(db);
  for (const name of DEFAULT_MISTAKES) {
    const ref = doc(mistakesCol(uid));
    batch.set(ref, {
      name,
      description: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/** Add any default mistakes missing from the user's library. */
export async function syncDefaultMistakes(uid: string): Promise<void> {
  const existing = await listMistakes(uid);
  const existingNames = new Set(
    existing.map((m) => m.name.trim().toLowerCase())
  );
  const missing = DEFAULT_MISTAKES.filter(
    (name) => !existingNames.has(name.trim().toLowerCase())
  );
  if (missing.length === 0) return;

  const batch = writeBatch(db);
  for (const name of missing) {
    const ref = doc(mistakesCol(uid));
    batch.set(ref, {
      name,
      description: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}
