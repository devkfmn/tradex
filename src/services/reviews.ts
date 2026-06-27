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
import type { Review, ReviewInput } from "../types";

function reviewsCol(uid: string) {
  return collection(db, "users", uid, "reviews");
}

function tsToMillis(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return null;
}

function fromDoc(id: string, data: Record<string, unknown>): Review {
  return {
    id,
    weekStartDate: (data.weekStartDate as string) ?? "",
    totalR: (data.totalR as number) ?? null,
    bestSetup: (data.bestSetup as string) ?? "",
    worstSetup: (data.worstSetup as string) ?? "",
    mainMistake: (data.mainMistake as string) ?? "",
    bestTrade: (data.bestTrade as string) ?? "",
    worstTrade: (data.worstTrade as string) ?? "",
    ruleFollowed: (data.ruleFollowed as Review["ruleFollowed"]) ?? "",
    decisionNextWeek: (data.decisionNextWeek as string) ?? "",
    createdAt: tsToMillis(data.createdAt),
    updatedAt: tsToMillis(data.updatedAt),
  };
}

export async function listReviews(uid: string): Promise<Review[]> {
  const q = query(reviewsCol(uid), orderBy("weekStartDate", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function addReview(
  uid: string,
  input: ReviewInput
): Promise<string> {
  const docRef = await addDoc(reviewsCol(uid), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateReview(
  uid: string,
  id: string,
  input: Partial<ReviewInput>
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "reviews", id), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteReview(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "reviews", id));
}
