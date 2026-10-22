import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDB } from "idb";
import type { CulturalProfile, Pocket, Profile, Transaction, Trip } from "@/types";
import {
  clearCulturalProfile,
  getCulturalProfile,
  saveCulturalProfile,
} from "@/lib/culture/profile";
import {
  VOLUNTRIP_DB_NAME,
  closeDB,
  createV1Stores,
  getPocketsByTrip,
  getProfile,
  getTransactionsByTrip,
  getActiveTrip,
} from "./indexeddb";

const profile: Profile = {
  id: "p1",
  displayName: "Traveler",
  locale: "en",
  preferredCurrency: "USD",
  onboardingComplete: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const trip: Trip = {
  id: "t1",
  destination: "Medellín, Colombia",
  city: "Medellín",
  country: "Colombia",
  countryCode: "CO",
  flag: "🇨🇴",
  baseCurrency: "USD",
  localCurrency: "COP",
  startDate: "2026-10-01",
  endDate: "2026-10-20",
  initialBudget: 1500,
  includedBenefits: ["accommodation"],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const pocket: Pocket = {
  id: "pk1",
  tripId: "t1",
  name: "Emergency",
  category: "emergency",
  balance: 300,
  allocated: 300,
  protected: true,
  icon: "shield",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const transaction: Transaction = {
  id: "tx1",
  tripId: "t1",
  amountOriginal: 20,
  currencyOriginal: "USD",
  exchangeRate: 1,
  amountBase: 20,
  currencyBase: "USD",
  concept: "Lunch",
  category: "food",
  source: "manual",
  createdAt: "2026-10-02T12:00:00.000Z",
};

const cultural: CulturalProfile = {
  id: "default",
  consent: { granted: true, grantedAt: "2026-10-19T00:00:00.000Z" },
  music: [{ label: "Salsa", qlooTagId: "urn:tag:genre:music:salsa" }],
  food: [{ label: "Coffee" }],
  entertainment: [],
  activities: [],
  updatedAt: "2026-10-19T00:00:00.000Z",
};

async function deleteDatabase() {
  await closeDB();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(VOLUNTRIP_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  await deleteDatabase();
});

describe("IndexedDB v1 → v2 cultural_profile migration", () => {
  it("keeps profile, trips, pockets, and transactions intact", async () => {
    const v1 = await openDB(VOLUNTRIP_DB_NAME, 1, {
      upgrade(db) {
        createV1Stores(db);
      },
    });
    expect(v1.objectStoreNames.contains("cultural_profile")).toBe(false);
    await v1.put("profile", profile);
    await v1.put("trips", trip);
    await v1.put("pockets", pocket);
    await v1.put("transactions", transaction);
    v1.close();
    await closeDB();

    expect(await getProfile()).toEqual(profile);
    expect(await getActiveTrip()).toEqual(trip);
    expect(await getPocketsByTrip("t1")).toEqual([pocket]);
    expect(await getTransactionsByTrip("t1")).toEqual([transaction]);

    const v2 = await openDB(VOLUNTRIP_DB_NAME, 2);
    expect([...v2.objectStoreNames]).toEqual(
      expect.arrayContaining([
        "profile",
        "trips",
        "pockets",
        "transactions",
        "goals",
        "insights",
        "messages",
        "meta",
        "cultural_profile",
      ])
    );
    v2.close();
    await closeDB();
  });
});

describe("cultural profile persistence", () => {
  it("persists optional lovedEntities on v2 and clears them with the profile", async () => {
    const withLove: CulturalProfile = {
      ...cultural,
      lovedEntities: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Bad Bunny",
          type: "urn:entity:artist",
        },
      ],
    };
    await saveCulturalProfile(withLove);
    await closeDB();
    expect(await getCulturalProfile()).toEqual(withLove);
    await clearCulturalProfile();
    expect(await getCulturalProfile()).toBeNull();
  });

  it("survives save, close, and reopen", async () => {
    await saveCulturalProfile(cultural);
    await closeDB();

    const loaded = await getCulturalProfile();
    expect(loaded).toEqual(cultural);
  });

  it("clearCulturalProfile removes only the cultural profile", async () => {
    const v1 = await openDB(VOLUNTRIP_DB_NAME, 1, {
      upgrade(db) {
        createV1Stores(db);
      },
    });
    await v1.put("profile", profile);
    await v1.put("trips", trip);
    await v1.put("pockets", pocket);
    await v1.put("transactions", transaction);
    v1.close();
    await closeDB();

    await saveCulturalProfile(cultural);
    expect(await getCulturalProfile()).not.toBeNull();

    await clearCulturalProfile();

    expect(await getCulturalProfile()).toBeNull();
    expect(await getProfile()).toEqual(profile);
    expect(await getActiveTrip()).toEqual(trip);
    expect(await getPocketsByTrip("t1")).toEqual([pocket]);
    expect(await getTransactionsByTrip("t1")).toEqual([transaction]);
  });
});
