import type {
  AIInsight,
  Goal,
  Pocket,
  Profile,
  Transaction,
  Trip,
} from "@/types";
import { createTransaction } from "@/lib/finance/transactions";
import { demoBudgetNow, endDateWithRemainingDays, isoDateLocal } from "./remainingDays";

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

type CityDemoSpec = {
  tripId: string;
  profileId: string;
  remainingDays: number;
  realAvailable: number;
  emergency: number;
  flight: number;
  destination: string;
  city: string;
  country: string;
  countryCode: string;
  flag: string;
  localCurrency: "COP" | "SGD";
  hostName: string;
  insightId: string;
  insightTitle: string;
  emergencyPocketId: string;
  flightPocketId: string;
};

const MEDELLIN_SPEC: CityDemoSpec = {
  tripId: "demo-trip-medellin",
  profileId: "demo-profile-medellin",
  remainingDays: 12,
  realAvailable: 428,
  emergency: 300,
  flight: 250,
  destination: "Medellín, Colombia",
  city: "Medellín",
  country: "Colombia",
  countryCode: "CO",
  flag: "🇨🇴",
  localCurrency: "COP",
  hostName: "Casa Voluntrip",
  insightId: "insight-med-1",
  insightTitle: "Medellín tonight",
  emergencyPocketId: "pocket-med-emergency",
  flightPocketId: "pocket-med-flight",
};

const SINGAPORE_SPEC: CityDemoSpec = {
  tripId: "demo-trip-singapore",
  profileId: "demo-profile-singapore",
  remainingDays: 9,
  realAvailable: 1800,
  emergency: 600,
  flight: 500,
  destination: "Singapore",
  city: "Singapore",
  country: "Singapore",
  countryCode: "SG",
  flag: "🇸🇬",
  localCurrency: "SGD",
  hostName: "Voluntrip House",
  insightId: "insight-sg-1",
  insightTitle: "Singapore tonight",
  emergencyPocketId: "pocket-sg-emergency",
  flightPocketId: "pocket-sg-flight",
};

function createCityDemoData(spec: CityDemoSpec, now: Date = new Date()) {
  const startDate = isoDateLocal(now);
  const endDate = endDateWithRemainingDays(spec.remainingDays, demoBudgetNow(now));
  const initialBudget = spec.realAvailable + spec.emergency + spec.flight;
  const createdAt = now.toISOString();

  const profile: Profile = {
    id: spec.profileId,
    displayName: "Traveler",
    locale: "en",
    preferredCurrency: "USD",
    onboardingComplete: true,
    avatarHue: 168,
    createdAt,
    updatedAt: createdAt,
  };

  const trip: Trip = {
    id: spec.tripId,
    destination: spec.destination,
    city: spec.city,
    country: spec.country,
    countryCode: spec.countryCode,
    flag: spec.flag,
    baseCurrency: "USD",
    localCurrency: spec.localCurrency,
    startDate,
    endDate,
    initialBudget,
    hostName: spec.hostName,
    includedBenefits: ["accommodation", "breakfast"],
    createdAt,
    updatedAt: createdAt,
  };

  const pockets: Pocket[] = [
    {
      id: spec.emergencyPocketId,
      tripId: spec.tripId,
      name: "Emergency",
      category: "emergency",
      balance: spec.emergency,
      allocated: spec.emergency,
      protected: true,
      icon: "shield",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: spec.flightPocketId,
      tripId: spec.tripId,
      name: "Return Flight",
      category: "return_flight",
      balance: spec.flight,
      allocated: spec.flight,
      protected: true,
      icon: "plane",
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const insights: AIInsight[] = [
    {
      id: spec.insightId,
      tripId: spec.tripId,
      type: "info",
      title: spec.insightTitle,
      message: `You have $${spec.realAvailable} real available and ${spec.remainingDays} days left. Ask NAVI what to do tonight.`,
      createdAt,
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

export function createMedellinDemoData(now: Date = new Date()) {
  return createCityDemoData(MEDELLIN_SPEC, now);
}

export function createSingaporeDemoData(now: Date = new Date()) {
  return createCityDemoData(SINGAPORE_SPEC, now);
}
