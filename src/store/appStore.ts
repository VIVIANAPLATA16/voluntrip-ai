"use client";

import { create } from "zustand";
import type {
  AIInsight,
  AgentMessage,
  CulturalProfile,
  CurrencyCode,
  Goal,
  HostBenefit,
  LocaleCode,
  Pocket,
  Profile,
  PurchaseSimulation,
  Transaction,
  Trip,
} from "@/types";
import * as db from "@/lib/db/indexeddb";
import {
  clearCulturalProfile as clearStoredCulturalProfile,
  getCulturalProfile as readCulturalProfile,
  saveCulturalProfile as persistCulturalProfile,
} from "@/lib/culture/profile";
import { DEMO_REMAINING_DAYS, demoBudgetNow, refreshDemoTripDates } from "@/lib/demo/remainingDays";
import { createDemoData, createMedellinDemoData, createSingaporeDemoData } from "@/lib/demo/sampleData";
import { createTransaction } from "@/lib/finance/transactions";
import { naviAgent } from "@/lib/agent/agent";
import { buildBudgetSnapshot, calculateMoneyRunway } from "@/lib/finance";
import { createId } from "@/lib/id";
import { detectBrowserLocale } from "@/lib/i18n/dictionaries";

interface OnboardingDraft {
  city: string;
  country: string;
  countryCode: string;
  flag: string;
  localCurrency: CurrencyCode;
  startDate: string;
  endDate: string;
  baseCurrency: CurrencyCode;
  includedBenefits: HostBenefit[];
  hostName: string;
  initialBudget: number;
  protectEmergency: number;
  protectFlight: number;
  protectCustom: number;
  protectCustomName: string;
}

interface AppStore {
  profile: Profile | null;
  trip: Trip | null;
  pockets: Pocket[];
  transactions: Transaction[];
  goals: Goal[];
  insights: AIInsight[];
  messages: AgentMessage[];
  hydrated: boolean;
  offline: boolean;
  locale: LocaleCode;
  pendingSimulation: PurchaseSimulation | null;
  pendingTransaction: Transaction | null;
  culturalProfile: CulturalProfile | null;
  onboarding: OnboardingDraft;

  hydrate: () => Promise<void>;
  setOffline: (v: boolean) => void;
  setLocale: (l: LocaleCode) => void;
  updateOnboarding: (patch: Partial<OnboardingDraft>) => void;
  completeOnboarding: () => Promise<void>;
  loadDemo: () => Promise<void>;
  loadMedellinDemo: () => Promise<void>;
  loadSingaporeDemo: () => Promise<void>;
  clearDemo: () => Promise<void>;
  addTransaction: (tx: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  upsertPocket: (pocket: Pocket) => Promise<void>;
  upsertGoal: (goal: Goal) => Promise<void>;
  askNavi: (text: string) => Promise<void>;
  confirmSimulation: () => Promise<void>;
  cancelSimulation: () => void;
  confirmPendingTransaction: () => Promise<void>;
  cancelPendingTransaction: () => void;
  getSnapshot: () => ReturnType<typeof buildBudgetSnapshot> | null;
  getRunway: () => ReturnType<typeof calculateMoneyRunway> | null;
  saveCulturalProfile: (profile: CulturalProfile) => Promise<void>;
  clearCulturalProfile: () => Promise<void>;
}

const defaultOnboarding = (): OnboardingDraft => {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 45);
  return {
    city: "",
    country: "",
    countryCode: "",
    flag: "",
    localCurrency: "THB",
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    baseCurrency: "USD",
    includedBenefits: [],
    hostName: "",
    initialBudget: 1500,
    protectEmergency: 0,
    protectFlight: 0,
    protectCustom: 0,
    protectCustomName: "Custom pocket",
  };
};

async function persistAll(state: {
  profile: Profile | null;
  trip: Trip | null;
  pockets: Pocket[];
  transactions: Transaction[];
  goals: Goal[];
  insights: AIInsight[];
}) {
  if (state.profile) await db.saveProfile(state.profile);
  if (state.trip) await db.saveTrip(state.trip);
  if (state.pockets.length) await db.savePockets(state.pockets);
  for (const tx of state.transactions) await db.saveTransaction(tx);
  for (const g of state.goals) await db.saveGoal(g);
  for (const i of state.insights) await db.saveInsight(i);
}

export const useAppStore = create<AppStore>((set, get) => ({
  profile: null,
  trip: null,
  pockets: [],
  transactions: [],
  goals: [],
  insights: [],
  messages: [],
  hydrated: false,
  offline: false,
  locale: "en",
  pendingSimulation: null,
  pendingTransaction: null,
  culturalProfile: null,
  onboarding: defaultOnboarding(),

  hydrate: async () => {
    try {
      const profile = await db.getProfile();
      const savedLocale = await db.getMeta<LocaleCode>("preferredLocale");
      const storedTrip = await db.getActiveTrip();
      const trip = storedTrip ? refreshDemoTripDates(storedTrip) : null;
      if (trip && storedTrip && (trip.endDate !== storedTrip.endDate || trip.startDate !== storedTrip.startDate)) {
        await db.saveTrip(trip);
      }
      let pockets: Pocket[] = [];
      let transactions: Transaction[] = [];
      let goals: Goal[] = [];
      let insights: AIInsight[] = [];
      if (trip) {
        pockets = await db.getPocketsByTrip(trip.id);
        transactions = await db.getTransactionsByTrip(trip.id);
        goals = await db.getGoalsByTrip(trip.id);
        insights = await db.getInsightsByTrip(trip.id);
      }
      const messages = await db.getMessages();
      naviAgent.memory.load(messages);
      const culturalProfile = await readCulturalProfile();

      let locale: LocaleCode = profile?.locale ?? savedLocale ?? "en";
      if (!profile && !savedLocale && typeof navigator !== "undefined") {
        locale = detectBrowserLocale();
      }

      set({
        profile,
        trip,
        pockets,
        transactions,
        goals,
        insights,
        messages,
        culturalProfile,
        locale,
        hydrated: true,
        offline: typeof navigator !== "undefined" ? !navigator.onLine : false,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  setOffline: (v) => set({ offline: v }),
  setLocale: (l) => {
    set({ locale: l });
    const profile = get().profile;
    if (profile) {
      const updated = { ...profile, locale: l, updatedAt: new Date().toISOString() };
      set({ profile: updated });
      void db.saveProfile(updated);
    } else {
      void db.setMeta("preferredLocale", l);
    }
  },

  updateOnboarding: (patch) =>
    set((s) => ({ onboarding: { ...s.onboarding, ...patch } })),

  completeOnboarding: async () => {
    const o = get().onboarding;
    const now = new Date().toISOString();
    const tripId = createId();
    const profile: Profile = {
      id: createId(),
      displayName: "Traveler",
      locale: get().locale,
      preferredCurrency: o.baseCurrency,
      onboardingComplete: true,
      avatarHue: 168,
      createdAt: now,
      updatedAt: now,
    };
    const trip: Trip = {
      id: tripId,
      destination: o.city ? `${o.city}, ${o.country}` : o.country,
      city: o.city || o.country,
      country: o.country,
      countryCode: o.countryCode,
      flag: o.flag,
      baseCurrency: o.baseCurrency,
      localCurrency: o.localCurrency,
      startDate: o.startDate,
      endDate: o.endDate,
      initialBudget: o.initialBudget,
      hostName: o.hostName || undefined,
      includedBenefits: o.includedBenefits,
      createdAt: now,
      updatedAt: now,
    };

    const pockets: Pocket[] = [];
    if (o.protectEmergency > 0) {
      pockets.push({
        id: createId(),
        tripId,
        name: "Emergency",
        category: "emergency",
        balance: o.protectEmergency,
        allocated: o.protectEmergency,
        protected: true,
        icon: "shield",
        createdAt: now,
        updatedAt: now,
      });
    }
    if (o.protectFlight > 0) {
      pockets.push({
        id: createId(),
        tripId,
        name: "Return Flight",
        category: "return_flight",
        balance: o.protectFlight,
        allocated: o.protectFlight,
        protected: true,
        icon: "plane",
        createdAt: now,
        updatedAt: now,
      });
    }
    if (o.protectCustom > 0) {
      pockets.push({
        id: createId(),
        tripId,
        name: o.protectCustomName || "Custom",
        category: "custom",
        balance: o.protectCustom,
        allocated: o.protectCustom,
        protected: true,
        icon: "wallet",
        createdAt: now,
        updatedAt: now,
      });
    }
    // Default spend pockets
    for (const p of [
      { name: "Food", category: "food" as const, icon: "utensils" },
      { name: "Transport", category: "transport" as const, icon: "bus" },
      { name: "Fun", category: "fun" as const, icon: "sparkles" },
    ]) {
      pockets.push({
        id: createId(),
        tripId,
        name: p.name,
        category: p.category,
        balance: 0,
        allocated: 0,
        protected: false,
        icon: p.icon,
        createdAt: now,
        updatedAt: now,
      });
    }

    await persistAll({
      profile,
      trip,
      pockets,
      transactions: [],
      goals: [],
      insights: [],
    });
    set({
      profile,
      trip,
      pockets,
      transactions: [],
      goals: [],
      insights: [],
    });
  },

  loadDemo: async () => {
    await db.clearAllData();
    const demo = createDemoData();
    await persistAll(demo);
    set({
      profile: demo.profile,
      trip: demo.trip,
      pockets: demo.pockets,
      transactions: demo.transactions,
      goals: demo.goals,
      insights: demo.insights,
      messages: [],
      culturalProfile: null,
      locale: demo.profile.locale,
    });
  },

  loadMedellinDemo: async () => {
    await db.clearAllData();
    const demo = createMedellinDemoData();
    await persistAll(demo);
    set({
      profile: demo.profile,
      trip: demo.trip,
      pockets: demo.pockets,
      transactions: demo.transactions,
      goals: demo.goals,
      insights: demo.insights,
      messages: [],
      culturalProfile: null,
      locale: demo.profile.locale,
    });
  },

  loadSingaporeDemo: async () => {
    await db.clearAllData();
    const demo = createSingaporeDemoData();
    await persistAll(demo);
    set({
      profile: demo.profile,
      trip: demo.trip,
      pockets: demo.pockets,
      transactions: demo.transactions,
      goals: demo.goals,
      insights: demo.insights,
      messages: [],
      culturalProfile: null,
      locale: demo.profile.locale,
    });
  },

  clearDemo: async () => {
    await db.clearAllData();
    set({
      profile: null,
      trip: null,
      pockets: [],
      transactions: [],
      goals: [],
      insights: [],
      messages: [],
      culturalProfile: null,
      onboarding: defaultOnboarding(),
    });
  },

  addTransaction: async (tx) => {
    await db.saveTransaction(tx);
    set((s) => ({
      transactions: [tx, ...s.transactions],
    }));
  },

  removeTransaction: async (id) => {
    await db.deleteTransaction(id);
    set((s) => ({
      transactions: s.transactions.filter((t) => t.id !== id),
    }));
  },

  upsertPocket: async (pocket) => {
    await db.savePocket(pocket);
    set((s) => {
      const exists = s.pockets.some((p) => p.id === pocket.id);
      return {
        pockets: exists
          ? s.pockets.map((p) => (p.id === pocket.id ? pocket : p))
          : [...s.pockets, pocket],
      };
    });
  },

  upsertGoal: async (goal) => {
    await db.saveGoal(goal);
    set((s) => {
      const exists = s.goals.some((g) => g.id === goal.id);
      return {
        goals: exists
          ? s.goals.map((g) => (g.id === goal.id ? goal : g))
          : [...s.goals, goal],
      };
    });
  },

  askNavi: async (text) => {
    const { trip, pockets, transactions, goals, locale, culturalProfile } = get();
    const result = await naviAgent.ask(text, {
      trip,
      pockets,
      transactions,
      goals,
      locale,
      culturalProfile,
    });
    const userMsg = {
      id: createId(),
      role: "user" as const,
      content: text,
      timestamp: new Date().toISOString(),
    };
    await db.saveMessage(userMsg);
    await db.saveMessage(result.message);

    for (const m of result.mutations) {
      if (m.type === "pocket" && m.payload) {
        await get().upsertPocket(m.payload as Pocket);
      }
      if (m.type === "goal" && m.payload) {
        await get().upsertGoal(m.payload as Goal);
      }
      if (m.type === "transaction" && m.payload && !result.pendingTransaction) {
        await get().addTransaction(m.payload as Transaction);
      }
    }

    set((s) => ({
      messages: [...s.messages, userMsg, result.message],
      pendingSimulation: result.simulation ?? null,
      pendingTransaction: (result.pendingTransaction as Transaction) ?? null,
    }));
  },

  confirmSimulation: async () => {
    const sim = get().pendingSimulation;
    const trip = get().trip;
    if (!sim || !trip) return;
    const tx = createTransaction({
      tripId: trip.id,
      amountOriginal: sim.purchaseAmount,
      currencyOriginal: sim.purchaseCurrency,
      currencyBase: trip.baseCurrency,
      concept: "Purchase",
      category: "general",
      source: "text",
    });
    await get().addTransaction(tx);
    set({ pendingSimulation: null });
  },

  cancelSimulation: () => set({ pendingSimulation: null }),

  confirmPendingTransaction: async () => {
    const tx = get().pendingTransaction;
    if (!tx) return;
    await get().addTransaction(tx);
    set({ pendingTransaction: null });
  },

  cancelPendingTransaction: () => set({ pendingTransaction: null }),

  getSnapshot: () => {
    const { trip, transactions, pockets } = get();
    if (!trip) return null;
    const now = DEMO_REMAINING_DAYS[trip.id] ? demoBudgetNow() : undefined;
    return buildBudgetSnapshot(trip, transactions, pockets, now);
  },

  getRunway: () => {
    const { trip, transactions, pockets } = get();
    if (!trip) return null;
    const now = DEMO_REMAINING_DAYS[trip.id] ? demoBudgetNow() : undefined;
    const snap = buildBudgetSnapshot(trip, transactions, pockets, now);
    return calculateMoneyRunway(trip, snap, now);
  },

  saveCulturalProfile: async (profile) => {
    const stored = await persistCulturalProfile(profile);
    set({ culturalProfile: stored });
  },

  clearCulturalProfile: async () => {
    await clearStoredCulturalProfile();
    set({ culturalProfile: null });
  },
}));
