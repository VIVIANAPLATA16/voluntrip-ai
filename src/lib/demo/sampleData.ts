import type {
  AIInsight,
  Goal,
  Pocket,
  Profile,
  Transaction,
  Trip,
} from "@/types";
import { createTransaction } from "@/lib/finance/transactions";
import { endDateWithRemainingDays, isoDateLocal } from "./remainingDays";

const now = new Date();
const start = new Date(now);
start.setDate(start.getDate() - 12);
const end = new Date(start);
end.setDate(end.getDate() + 45);

export function createDemoData() {
  const tripId = "demo-trip-chiang-mai";
  const profileId = "demo-profile";

  const profile: Profile = {
    id: profileId,
    displayName: "Traveler",
    locale: "en",
    preferredCurrency: "USD",
    onboardingComplete: true,
    avatarHue: 168,
    createdAt: start.toISOString(),
    updatedAt: now.toISOString(),
  };

  const trip: Trip = {
    id: tripId,
    destination: "Chiang Mai, Thailand",
    city: "Chiang Mai",
    country: "Thailand",
    countryCode: "TH",
    flag: "🇹🇭",
    baseCurrency: "USD",
    localCurrency: "THB",
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    initialBudget: 1500,
    hostName: "Northern Garden Hostel",
    includedBenefits: ["accommodation", "breakfast"],
    createdAt: start.toISOString(),
    updatedAt: now.toISOString(),
  };

  const pockets: Pocket[] = [
    {
      id: "pocket-emergency",
      tripId,
      name: "Emergency",
      category: "emergency",
      balance: 300,
      allocated: 300,
      protected: true,
      icon: "shield",
      createdAt: start.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "pocket-flight",
      tripId,
      name: "Return Flight",
      category: "return_flight",
      balance: 250,
      allocated: 250,
      protected: true,
      icon: "plane",
      createdAt: start.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "pocket-food",
      tripId,
      name: "Food",
      category: "food",
      balance: 200,
      allocated: 280,
      protected: false,
      icon: "utensils",
      createdAt: start.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "pocket-transport",
      tripId,
      name: "Transport",
      category: "transport",
      balance: 80,
      allocated: 100,
      protected: false,
      icon: "bus",
      createdAt: start.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "pocket-fun",
      tripId,
      name: "Fun",
      category: "fun",
      balance: 120,
      allocated: 150,
      protected: false,
      icon: "sparkles",
      createdAt: start.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  const txBase = {
    tripId,
    currencyBase: "USD" as const,
    source: "manual" as const,
  };

  const daysAgo = (d: number, hour = 12) => {
    const t = new Date(now);
    t.setDate(t.getDate() - d);
    t.setHours(hour, 30, 0, 0);
    return t.toISOString();
  };

  const transactions: Transaction[] = [
    createTransaction({
      ...txBase,
      pocketId: "pocket-food",
      amountOriginal: 180,
      currencyOriginal: "THB",
      concept: "Lunch",
      category: "food",
      createdAt: daysAgo(1, 13),
      id: "tx-lunch",
    }),
    createTransaction({
      ...txBase,
      pocketId: "pocket-transport",
      amountOriginal: 120,
      currencyOriginal: "THB",
      concept: "Taxi",
      category: "transport",
      createdAt: daysAgo(1, 18),
      id: "tx-taxi",
    }),
    createTransaction({
      ...txBase,
      pocketId: "pocket-food",
      amountOriginal: 80,
      currencyOriginal: "THB",
      concept: "Coffee",
      category: "food",
      createdAt: daysAgo(2, 9),
      id: "tx-coffee",
    }),
    createTransaction({
      ...txBase,
      pocketId: "pocket-food",
      amountOriginal: 450,
      currencyOriginal: "THB",
      concept: "Market",
      category: "food",
      createdAt: daysAgo(3, 11),
      id: "tx-market",
    }),
  ];

  const goals: Goal[] = [
    {
      id: "goal-bali",
      tripId,
      name: "Save for Bali",
      targetAmount: 250,
      currentAmount: 120,
      currency: "USD",
      protected: false,
      createdAt: start.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  const insights: AIInsight[] = [
    {
      id: "insight-1",
      tripId,
      type: "success",
      title: "On track",
      message:
        "Your host covers accommodation and breakfast — focus your free budget on lunch, dinner, and experiences.",
      createdAt: now.toISOString(),
    },
  ];

  return { profile, trip, pockets, transactions, goals, insights };
}

export function createMedellinDemoData(now: Date = new Date()) {
  const tripId = "demo-trip-medellin";
  const profileId = "demo-profile-medellin";
  const startDate = isoDateLocal(now);
  const endDate = endDateWithRemainingDays(12, now);

  const profile: Profile = {
    id: profileId,
    displayName: "Traveler",
    locale: "en",
    preferredCurrency: "USD",
    onboardingComplete: true,
    avatarHue: 168,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const trip: Trip = {
    id: tripId,
    destination: "Medellín, Colombia",
    city: "Medellín",
    country: "Colombia",
    countryCode: "CO",
    flag: "🇨🇴",
    baseCurrency: "USD",
    localCurrency: "COP",
    startDate,
    endDate,
    initialBudget: 978,
    hostName: "Casa Voluntrip",
    includedBenefits: ["accommodation", "breakfast"],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const pockets: Pocket[] = [
    {
      id: "pocket-med-emergency",
      tripId,
      name: "Emergency",
      category: "emergency",
      balance: 300,
      allocated: 300,
      protected: true,
      icon: "shield",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "pocket-med-flight",
      tripId,
      name: "Return Flight",
      category: "return_flight",
      balance: 250,
      allocated: 250,
      protected: true,
      icon: "plane",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  const insights: AIInsight[] = [
    {
      id: "insight-med-1",
      tripId,
      type: "info",
      title: "Medellín tonight",
      message:
        "You have $428 real available and 12 days left. Ask NAVI what to do tonight.",
      createdAt: now.toISOString(),
    },
  ];

  return {
    profile,
    trip,
    pockets,
    transactions: [] as Transaction[],
    goals: [] as Goal[],
    insights,
  };
}
