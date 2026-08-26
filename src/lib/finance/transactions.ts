import type { CurrencyCode, Transaction, TransactionSource } from "@/types";
import { createId } from "@/lib/id";
import { toBaseAmount } from "./currency";

export interface CreateTransactionInput {
  tripId: string;
  pocketId?: string;
  amountOriginal: number;
  currencyOriginal: CurrencyCode;
  currencyBase: CurrencyCode;
  concept: string;
  category: string;
  source: TransactionSource;
  note?: string;
  id?: string;
  createdAt?: string;
  rates?: Record<string, number>;
}

export function createTransaction(input: CreateTransactionInput): Transaction {
  const { amountBase, exchangeRate } = toBaseAmount(
    input.amountOriginal,
    input.currencyOriginal,
    input.currencyBase,
    input.rates
  );

  return {
    id: input.id ?? createId(),
    tripId: input.tripId,
    pocketId: input.pocketId,
    amountOriginal: input.amountOriginal,
    currencyOriginal: input.currencyOriginal,
    exchangeRate,
    amountBase,
    currencyBase: input.currencyBase,
    concept: input.concept,
    category: input.category,
    source: input.source,
    createdAt: input.createdAt ?? new Date().toISOString(),
    note: input.note,
  };
}

export function updateTransaction(
  tx: Transaction,
  patch: Partial<Omit<Transaction, "id" | "tripId">>
): Transaction {
  return { ...tx, ...patch };
}

export function deleteTransaction(
  transactions: Transaction[],
  id: string
): Transaction[] {
  return transactions.filter((t) => t.id !== id);
}

export function groupByCategory(transactions: Transaction[]): Record<string, number> {
  return transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amountBase;
    return acc;
  }, {});
}

export function transactionsInRange(
  transactions: Transaction[],
  start: Date,
  end: Date
): Transaction[] {
  return transactions.filter((t) => {
    const d = new Date(t.createdAt);
    return d >= start && d <= end;
  });
}
