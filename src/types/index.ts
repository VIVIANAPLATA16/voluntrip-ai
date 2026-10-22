/** Core domain types for Voluntrip AI */

/** ISO 4217 currency code — open set for global travel */
export type CurrencyCode = string;

export type LocaleCode = "en" | "es" | "pt";

export type HostBenefit =
  | "accommodation"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "laundry"
  | "transport"
  | "tours";

export type TransactionSource = "text" | "voice" | "receipt" | "manual";

export type PocketCategory =
  | "emergency"
  | "food"
  | "transport"
  | "fun"
  | "return_flight"
  | "debt"
  | "savings"
  | "custom";

export type SpendingStatus = "on_track" | "careful" | "at_risk";

export type NaviState = "idle" | "listening" | "thinking" | "success" | "error";

export interface Profile {
  id: string;
  displayName: string;
  locale: LocaleCode;
  preferredCurrency: CurrencyCode;
  onboardingComplete: boolean;
  avatarHue?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Operational preference like — not a diagnosis.
 * `qlooTagId` stays empty until a later phase verifies it against Qloo.
 */
export interface CulturalLike {
  label: string;
  qlooTagId?: string;
}

/**
 * Local Cultural DNA. Never store name, email, or device IDs here.
 * id is always `"default"` (one profile per device / local database).
 */
export interface CulturalProfile {
  id: "default";
  consent: {
    granted: boolean;
    grantedAt: string | null;
  };
  music: CulturalLike[];
  food: CulturalLike[];
  entertainment: CulturalLike[];
  activities: CulturalLike[];
  /** Optional loved Qloo entities. Present only with consent; omitted on older records. */
  lovedEntities?: Array<{ id: string; name: string; type: string }>;
  updatedAt: string;
}

export interface VolunteerSetup {
  hostName?: string;
  includedBenefits: HostBenefit[];
}

export interface Trip {
  id: string;
  destination: string;
  city: string;
  country: string;
  countryCode: string;
  flag: string;
  baseCurrency: CurrencyCode;
  localCurrency: CurrencyCode;
  startDate: string;
  endDate: string;
  initialBudget: number;
  hostName?: string;
  includedBenefits: HostBenefit[];
  createdAt: string;
  updatedAt: string;
}

export interface Pocket {
  id: string;
  tripId: string;
  name: string;
  category: PocketCategory;
  balance: number;
  allocated: number;
  protected: boolean;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  tripId: string;
  pocketId?: string;
  amountOriginal: number;
  currencyOriginal: CurrencyCode;
  exchangeRate: number;
  amountBase: number;
  currencyBase: CurrencyCode;
  concept: string;
  category: string;
  source: TransactionSource;
  createdAt: string;
  note?: string;
}

export interface Goal {
  id: string;
  tripId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: CurrencyCode;
  protected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Currency {
  code: CurrencyCode;
  name: string;
  symbol: string;
  decimals: number;
}

export interface ExchangeRate {
  base: CurrencyCode;
  rates: Record<string, number>;
  timestamp: string;
  source: "mock" | "api";
}

export interface AIInsight {
  id: string;
  tripId: string;
  type: "warning" | "success" | "info" | "tip";
  title: string;
  message: string;
  createdAt: string;
  dismissed?: boolean;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  toolCalls?: AgentToolCall[];
  locale?: LocaleCode;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "success" | "error";
}

export interface PurchaseSimulation {
  purchaseAmount: number;
  purchaseCurrency: CurrencyCode;
  purchaseAmountBase: number;
  availableBefore: number;
  availableAfter: number;
  dailyBudgetBefore: number;
  dailyBudgetAfter: number;
  weeklyBudgetBefore: number;
  weeklyBudgetAfter: number;
  affordable: boolean;
  impactMessage: string;
  daysImpacted: number;
}

export interface MoneyRunwayResult {
  runwayDate: string;
  daysRemaining: number;
  tripEndDate: string;
  daysEarly: number;
  status: SpendingStatus;
  message: string;
}

export interface BudgetSnapshot {
  totalBalance: number;
  protectedMoney: number;
  realAvailable: number;
  daysRemaining: number;
  weeksRemaining: number;
  dailySafeSpend: number;
  weeklySafeSpend: number;
  status: SpendingStatus;
  spentTotal: number;
  averageDailySpend: number;
}

export interface AppState {
  profile: Profile | null;
  trip: Trip | null;
  pockets: Pocket[];
  transactions: Transaction[];
  goals: Goal[];
  insights: AIInsight[];
  hydrated: boolean;
  offline: boolean;
}
