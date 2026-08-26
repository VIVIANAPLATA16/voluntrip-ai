/**
 * IndexedDB ↔ Supabase sync.
 * Safe when cloud is not configured: all exports no-op gracefully.
 */

import type { Goal, LocaleCode, Pocket, Profile, Transaction, Trip } from "@/types";
import * as db from "@/lib/db/indexeddb";
import {
  createSupabaseBrowserClient,
  isCloudConfigured as clientConfigured,
} from "@/lib/supabase/client";

export interface SyncStatus {
  online: boolean;
  lastSyncedAt: string | null;
  pendingMutations: number;
  cloudEnabled: boolean;
}

export interface SyncResult {
  ok: boolean;
  message: string;
  preferredCloud?: boolean;
}

export function isCloudConfigured(): boolean {
  return clientConfigured();
}

export async function getSyncStatus(): Promise<SyncStatus> {
  let lastSyncedAt: string | null = null;
  try {
    if (typeof window !== "undefined") {
      lastSyncedAt = await db.getMeta<string>("lastSyncedAt");
    }
  } catch {
    /* ignore */
  }
  return {
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    lastSyncedAt,
    pendingMutations: 0,
    cloudEnabled: isCloudConfigured(),
  };
}

function toIso(value: string | null | undefined, fallback?: string): string {
  if (!value) return fallback || new Date().toISOString();
  return new Date(value).toISOString();
}

function mapProfileToRow(profile: Profile, userId: string) {
  return {
    id: userId,
    display_name: profile.displayName,
    locale: profile.locale,
    preferred_currency: profile.preferredCurrency,
    onboarding_complete: profile.onboardingComplete,
    avatar_hue: profile.avatarHue ?? null,
    created_at: toIso(profile.createdAt),
    updated_at: toIso(profile.updatedAt),
  };
}

function mapTripToRow(trip: Trip, userId: string) {
  return {
    id: trip.id,
    user_id: userId,
    destination: trip.destination,
    city: trip.city,
    country: trip.country,
    country_code: trip.countryCode,
    flag: trip.flag,
    base_currency: trip.baseCurrency,
    local_currency: trip.localCurrency,
    start_date: trip.startDate.slice(0, 10),
    end_date: trip.endDate.slice(0, 10),
    initial_budget: trip.initialBudget,
    host_name: trip.hostName ?? null,
    included_benefits: trip.includedBenefits ?? [],
    created_at: toIso(trip.createdAt),
    updated_at: toIso(trip.updatedAt),
  };
}

function mapPocketToRow(pocket: Pocket, userId: string) {
  return {
    id: pocket.id,
    trip_id: pocket.tripId,
    user_id: userId,
    name: pocket.name,
    category: pocket.category,
    balance: pocket.balance,
    allocated: pocket.allocated,
    protected: pocket.protected,
    icon: pocket.icon,
    created_at: toIso(pocket.createdAt),
    updated_at: toIso(pocket.updatedAt),
  };
}

function mapTxToRow(tx: Transaction, userId: string) {
  return {
    id: tx.id,
    trip_id: tx.tripId,
    user_id: userId,
    pocket_id: tx.pocketId ?? null,
    amount_original: tx.amountOriginal,
    currency_original: tx.currencyOriginal,
    exchange_rate: tx.exchangeRate,
    amount_base: tx.amountBase,
    currency_base: tx.currencyBase,
    concept: tx.concept,
    category: tx.category,
    source: tx.source,
    created_at: toIso(tx.createdAt),
    note: tx.note ?? null,
  };
}

function mapGoalToRow(goal: Goal, userId: string) {
  return {
    id: goal.id,
    trip_id: goal.tripId,
    user_id: userId,
    name: goal.name,
    target_amount: goal.targetAmount,
    current_amount: goal.currentAmount,
    currency: goal.currency,
    protected: goal.protected,
    created_at: toIso(goal.createdAt),
    updated_at: toIso(goal.updatedAt),
  };
}

function mapProfileFromRow(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    displayName: String(row.display_name || "Traveler"),
    locale: (row.locale as LocaleCode) || "en",
    preferredCurrency: String(row.preferred_currency || "USD"),
    onboardingComplete: Boolean(row.onboarding_complete),
    avatarHue: row.avatar_hue != null ? Number(row.avatar_hue) : undefined,
    createdAt: toIso(row.created_at as string),
    updatedAt: toIso(row.updated_at as string),
  };
}

function mapTripFromRow(row: Record<string, unknown>): Trip {
  return {
    id: String(row.id),
    destination: String(row.destination),
    city: String(row.city),
    country: String(row.country),
    countryCode: String(row.country_code || ""),
    flag: String(row.flag || ""),
    baseCurrency: String(row.base_currency),
    localCurrency: String(row.local_currency),
    startDate: String(row.start_date).slice(0, 10),
    endDate: String(row.end_date).slice(0, 10),
    initialBudget: Number(row.initial_budget) || 0,
    hostName: row.host_name ? String(row.host_name) : undefined,
    includedBenefits: Array.isArray(row.included_benefits)
      ? (row.included_benefits as Trip["includedBenefits"])
      : [],
    createdAt: toIso(row.created_at as string),
    updatedAt: toIso(row.updated_at as string),
  };
}

function mapPocketFromRow(row: Record<string, unknown>): Pocket {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    name: String(row.name),
    category: row.category as Pocket["category"],
    balance: Number(row.balance) || 0,
    allocated: Number(row.allocated) || 0,
    protected: Boolean(row.protected),
    icon: String(row.icon || "wallet"),
    createdAt: toIso(row.created_at as string),
    updatedAt: toIso(row.updated_at as string),
  };
}

function mapTxFromRow(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    pocketId: row.pocket_id ? String(row.pocket_id) : undefined,
    amountOriginal: Number(row.amount_original) || 0,
    currencyOriginal: String(row.currency_original),
    exchangeRate: Number(row.exchange_rate) || 1,
    amountBase: Number(row.amount_base) || 0,
    currencyBase: String(row.currency_base),
    concept: String(row.concept),
    category: String(row.category),
    source: (row.source as Transaction["source"]) || "manual",
    createdAt: toIso(row.created_at as string),
    note: row.note ? String(row.note) : undefined,
  };
}

function mapGoalFromRow(row: Record<string, unknown>): Goal {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    name: String(row.name),
    targetAmount: Number(row.target_amount) || 0,
    currentAmount: Number(row.current_amount) || 0,
    currency: String(row.currency),
    protected: Boolean(row.protected),
    createdAt: toIso(row.created_at as string),
    updatedAt: toIso(row.updated_at as string),
  };
}

async function clearLocalTripData() {
  const idb = await db.getDB();
  await Promise.all([
    idb.clear("profile"),
    idb.clear("trips"),
    idb.clear("pockets"),
    idb.clear("transactions"),
    idb.clear("goals"),
  ]);
}

async function applyRemoteToLocal(params: {
  profile: Profile | null;
  trips: Trip[];
  pockets: Pocket[];
  transactions: Transaction[];
  goals: Goal[];
}) {
  await clearLocalTripData();
  if (params.profile) await db.saveProfile(params.profile);
  for (const trip of params.trips) await db.saveTrip(trip);
  if (params.pockets.length) await db.savePockets(params.pockets);
  for (const tx of params.transactions) await db.saveTransaction(tx);
  for (const goal of params.goals) await db.saveGoal(goal);
  await db.setMeta("lastSyncedAt", new Date().toISOString());
}

export async function pushLocalChanges(): Promise<SyncResult> {
  if (!isCloudConfigured()) {
    return {
      ok: false,
      message: "Cloud sync not configured. Add Supabase env vars to enable backup.",
    };
  }

  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    return { ok: false, message: "Cloud sync not configured." };
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { ok: false, message: "Not signed in." };
    }

    const profile = await db.getProfile();
    const trip = await db.getActiveTrip();
    if (!profile && !trip) {
      return { ok: true, message: "Nothing local to upload." };
    }

    if (profile) {
      const { error } = await supabase
        .from("profiles")
        .upsert(mapProfileToRow(profile, user.id), { onConflict: "id" });
      if (error) return { ok: false, message: error.message };
    }

    if (trip) {
      const pockets = await db.getPocketsByTrip(trip.id);
      const transactions = await db.getTransactionsByTrip(trip.id);
      const goals = await db.getGoalsByTrip(trip.id);

      const { error: tripErr } = await supabase
        .from("trips")
        .upsert(mapTripToRow(trip, user.id), { onConflict: "id" });
      if (tripErr) return { ok: false, message: tripErr.message };

      if (pockets.length) {
        const { error } = await supabase
          .from("pockets")
          .upsert(
            pockets.map((p) => mapPocketToRow(p, user.id)),
            { onConflict: "id" }
          );
        if (error) return { ok: false, message: error.message };
      }

      if (transactions.length) {
        const { error } = await supabase
          .from("transactions")
          .upsert(
            transactions.map((tx) => mapTxToRow(tx, user.id)),
            { onConflict: "id" }
          );
        if (error) return { ok: false, message: error.message };
      }

      if (goals.length) {
        const { error } = await supabase
          .from("goals")
          .upsert(
            goals.map((g) => mapGoalToRow(g, user.id)),
            { onConflict: "id" }
          );
        if (error) return { ok: false, message: error.message };
      }
    }

    await db.setMeta("lastSyncedAt", new Date().toISOString());
    return { ok: true, message: "Local data uploaded to cloud." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Upload failed.",
    };
  }
}

export async function pullRemoteChanges(): Promise<SyncResult> {
  if (!isCloudConfigured()) {
    return { ok: false, message: "Cloud sync not configured." };
  }

  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    return { ok: false, message: "Cloud sync not configured." };
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { ok: false, message: "Not signed in." };
    }

    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (profileErr) return { ok: false, message: profileErr.message };

    const { data: tripRows, error: tripErr } = await supabase
      .from("trips")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (tripErr) return { ok: false, message: tripErr.message };

    if (!profileRow && (!tripRows || tripRows.length === 0)) {
      return { ok: true, message: "No cloud data yet." };
    }

    const trips = (tripRows || []).map((r) => mapTripFromRow(r as Record<string, unknown>));
    const tripIds = trips.map((t) => t.id);

    let pockets: Pocket[] = [];
    let transactions: Transaction[] = [];
    let goals: Goal[] = [];

    if (tripIds.length) {
      const [pRes, tRes, gRes] = await Promise.all([
        supabase.from("pockets").select("*").eq("user_id", user.id),
        supabase.from("transactions").select("*").eq("user_id", user.id),
        supabase.from("goals").select("*").eq("user_id", user.id),
      ]);
      if (pRes.error) return { ok: false, message: pRes.error.message };
      if (tRes.error) return { ok: false, message: tRes.error.message };
      if (gRes.error) return { ok: false, message: gRes.error.message };

      pockets = (pRes.data || []).map((r) => mapPocketFromRow(r as Record<string, unknown>));
      transactions = (tRes.data || []).map((r) => mapTxFromRow(r as Record<string, unknown>));
      goals = (gRes.data || []).map((r) => mapGoalFromRow(r as Record<string, unknown>));
    }

    const profile = profileRow
      ? mapProfileFromRow(profileRow as Record<string, unknown>)
      : null;

    await applyRemoteToLocal({ profile, trips, pockets, transactions, goals });

    return { ok: true, message: "Cloud data loaded into this device." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Download failed.",
    };
  }
}

/**
 * Post-login sync:
 * - If cloud has data → prefer cloud (overwrite local), set preferredCloud.
 * - Else if local has data → push to cloud.
 */
export async function syncAfterAuth(): Promise<SyncResult> {
  if (!isCloudConfigured()) {
    return { ok: false, message: "Cloud sync not configured." };
  }

  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    return { ok: false, message: "Cloud sync not configured." };
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "Not signed in." };

    const { data: remoteTrips, error } = await supabase
      .from("trips")
      .select("id, updated_at")
      .eq("user_id", user.id)
      .limit(1);
    if (error) return { ok: false, message: error.message };

    const hasRemote = Boolean(remoteTrips && remoteTrips.length > 0);
    const localTrip = await db.getActiveTrip();
    const hasLocal = Boolean(localTrip);

    if (hasRemote) {
      const pull = await pullRemoteChanges();
      return {
        ...pull,
        preferredCloud: hasLocal,
        message: hasLocal
          ? "Cloud backup restored (preferred over local data on this device)."
          : pull.message,
      };
    }

    if (hasLocal) {
      return pushLocalChanges();
    }

    return { ok: true, message: "Signed in. Nothing to sync yet." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Sync failed.",
    };
  }
}
