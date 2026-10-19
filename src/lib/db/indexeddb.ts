import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  AIInsight,
  AgentMessage,
  CulturalProfile,
  Goal,
  Pocket,
  Profile,
  Transaction,
  Trip,
} from "@/types";

interface VoluntripDB extends DBSchema {
  profile: {
    key: string;
    value: Profile;
  };
  trips: {
    key: string;
    value: Trip;
  };
  pockets: {
    key: string;
    value: Pocket;
    indexes: { "by-trip": string };
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: { "by-trip": string };
  };
  goals: {
    key: string;
    value: Goal;
    indexes: { "by-trip": string };
  };
  insights: {
    key: string;
    value: AIInsight;
    indexes: { "by-trip": string };
  };
  messages: {
    key: string;
    value: AgentMessage;
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
  cultural_profile: {
    key: string;
    value: CulturalProfile;
  };
}

export const VOLUNTRIP_DB_NAME = "voluntrip-ai";
export const VOLUNTRIP_DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<VoluntripDB>> | null = null;

type UpgradeDB = Pick<IDBPDatabase<VoluntripDB>, "objectStoreNames" | "createObjectStore">;

/** Historical v1 stores — used by tests to seed a pre-2.0 database. */
export function createV1Stores(db: UpgradeDB) {
  if (!db.objectStoreNames.contains("profile")) {
    db.createObjectStore("profile", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("trips")) {
    db.createObjectStore("trips", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("pockets")) {
    const store = db.createObjectStore("pockets", { keyPath: "id" });
    store.createIndex("by-trip", "tripId");
  }
  if (!db.objectStoreNames.contains("transactions")) {
    const store = db.createObjectStore("transactions", { keyPath: "id" });
    store.createIndex("by-trip", "tripId");
  }
  if (!db.objectStoreNames.contains("goals")) {
    const store = db.createObjectStore("goals", { keyPath: "id" });
    store.createIndex("by-trip", "tripId");
  }
  if (!db.objectStoreNames.contains("insights")) {
    const store = db.createObjectStore("insights", { keyPath: "id" });
    store.createIndex("by-trip", "tripId");
  }
  if (!db.objectStoreNames.contains("messages")) {
    db.createObjectStore("messages", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("meta")) {
    db.createObjectStore("meta", { keyPath: "key" });
  }
}

/** Additive upgrades only — never delete existing stores. */
export function upgradeVoluntripDB(db: UpgradeDB, oldVersion: number) {
  if (oldVersion < 1) {
    createV1Stores(db);
  }
  if (oldVersion < 2) {
    if (!db.objectStoreNames.contains("cultural_profile")) {
      db.createObjectStore("cultural_profile", { keyPath: "id" });
    }
  }
}

export function getDB() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB<VoluntripDB>(VOLUNTRIP_DB_NAME, VOLUNTRIP_DB_VERSION, {
      upgrade(db, oldVersion) {
        upgradeVoluntripDB(db, oldVersion);
      },
    });
  }
  return dbPromise;
}

/** Test helper: close the cached connection so the next open can upgrade. */
export async function closeDB() {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}

export async function saveProfile(profile: Profile) {
  const db = await getDB();
  await db.put("profile", profile);
}

export async function getProfile(): Promise<Profile | null> {
  const db = await getDB();
  const all = await db.getAll("profile");
  return all[0] ?? null;
}

export async function saveTrip(trip: Trip) {
  const db = await getDB();
  await db.put("trips", trip);
}

export async function getActiveTrip(): Promise<Trip | null> {
  const db = await getDB();
  const trips = await db.getAll("trips");
  return trips.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0] ?? null;
}

export async function savePocket(pocket: Pocket) {
  const db = await getDB();
  await db.put("pockets", pocket);
}

export async function savePockets(pockets: Pocket[]) {
  const db = await getDB();
  const tx = db.transaction("pockets", "readwrite");
  await Promise.all([...pockets.map((p) => tx.store.put(p)), tx.done]);
}

export async function getPocketsByTrip(tripId: string): Promise<Pocket[]> {
  const db = await getDB();
  return db.getAllFromIndex("pockets", "by-trip", tripId);
}

export async function saveTransaction(transaction: Transaction) {
  const db = await getDB();
  await db.put("transactions", transaction);
}

export async function deleteTransaction(id: string) {
  const db = await getDB();
  await db.delete("transactions", id);
}

export async function getTransactionsByTrip(tripId: string): Promise<Transaction[]> {
  const db = await getDB();
  const list = await db.getAllFromIndex("transactions", "by-trip", tripId);
  return list.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function saveGoal(goal: Goal) {
  const db = await getDB();
  await db.put("goals", goal);
}

export async function getGoalsByTrip(tripId: string): Promise<Goal[]> {
  const db = await getDB();
  return db.getAllFromIndex("goals", "by-trip", tripId);
}

export async function saveInsight(insight: AIInsight) {
  const db = await getDB();
  await db.put("insights", insight);
}

export async function getInsightsByTrip(tripId: string): Promise<AIInsight[]> {
  const db = await getDB();
  return db.getAllFromIndex("insights", "by-trip", tripId);
}

export async function saveMessage(message: AgentMessage) {
  const db = await getDB();
  await db.put("messages", message);
}

export async function getMessages(): Promise<AgentMessage[]> {
  const db = await getDB();
  const list = await db.getAll("messages");
  return list.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export async function saveCulturalProfileRecord(profile: CulturalProfile) {
  const db = await getDB();
  await db.put("cultural_profile", profile);
}

export async function getCulturalProfileRecord(): Promise<CulturalProfile | null> {
  const db = await getDB();
  return (await db.get("cultural_profile", "default")) ?? null;
}

export async function deleteCulturalProfileRecord() {
  const db = await getDB();
  await db.delete("cultural_profile", "default");
}

export async function clearAllData() {
  const db = await getDB();
  const stores = [
    "profile",
    "trips",
    "pockets",
    "transactions",
    "goals",
    "insights",
    "messages",
    "meta",
    "cultural_profile",
  ] as const;
  await Promise.all(stores.map((s) => db.clear(s)));
}

export async function setMeta(key: string, value: unknown) {
  const db = await getDB();
  await db.put("meta", { key, value });
}

export async function getMeta<T>(key: string): Promise<T | null> {
  const db = await getDB();
  const row = await db.get("meta", key);
  return (row?.value as T) ?? null;
}

/** Sync layer stub — ready for Supabase */
export async function syncToCloud(): Promise<{ ok: boolean; reason: string }> {
  return {
    ok: false,
    reason: "Cloud sync not configured. Set SUPABASE_URL to enable.",
  };
}
