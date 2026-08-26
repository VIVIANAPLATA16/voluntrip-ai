import type { Pocket, PocketCategory } from "@/types";

export const DEFAULT_POCKET_TEMPLATES: Array<{
  name: string;
  category: PocketCategory;
  icon: string;
  protected: boolean;
}> = [
  { name: "Emergency", category: "emergency", icon: "shield", protected: true },
  { name: "Food", category: "food", icon: "utensils", protected: false },
  { name: "Transport", category: "transport", icon: "bus", protected: false },
  { name: "Fun", category: "fun", icon: "sparkles", protected: false },
  { name: "Return Flight", category: "return_flight", icon: "plane", protected: true },
  { name: "Debt", category: "debt", icon: "credit-card", protected: true },
  { name: "Savings", category: "savings", icon: "piggy-bank", protected: false },
];

export function pocketUsagePercent(pocket: Pocket): number {
  if (pocket.allocated <= 0) return 0;
  const used = pocket.allocated - pocket.balance;
  return Math.min(100, Math.max(0, (used / pocket.allocated) * 100));
}

export function isPocketSpendable(pocket: Pocket): boolean {
  return !pocket.protected && pocket.balance > 0;
}

export function protectPocket(pocket: Pocket): Pocket {
  return { ...pocket, protected: true, updatedAt: new Date().toISOString() };
}

export function unprotectPocket(pocket: Pocket): Pocket {
  return { ...pocket, protected: false, updatedAt: new Date().toISOString() };
}

export function allocateToPocket(pocket: Pocket, amount: number): Pocket {
  return {
    ...pocket,
    balance: pocket.balance + amount,
    allocated: pocket.allocated + amount,
    updatedAt: new Date().toISOString(),
  };
}
