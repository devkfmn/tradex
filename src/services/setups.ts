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
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Setup, SetupInput } from "../types";

function setupsCol(uid: string) {
  return collection(db, "users", uid, "setups");
}

function tsToMillis(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return null;
}

function fromDoc(id: string, data: Record<string, unknown>): Setup {
  return {
    id,
    name: (data.name as string) ?? "",
    rules: (data.rules as string) ?? "",
    bestConditions: (data.bestConditions as string) ?? "",
    invalidConditions: (data.invalidConditions as string) ?? "",
    createdAt: tsToMillis(data.createdAt),
    updatedAt: tsToMillis(data.updatedAt),
  };
}

export async function listSetups(uid: string): Promise<Setup[]> {
  const q = query(setupsCol(uid), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function addSetup(uid: string, input: SetupInput): Promise<string> {
  const docRef = await addDoc(setupsCol(uid), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateSetup(
  uid: string,
  id: string,
  input: Partial<SetupInput>
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "setups", id), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSetup(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "setups", id));
}
