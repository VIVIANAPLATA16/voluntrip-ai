import type { CurrencyCode, Pocket, Transaction } from "@/types";
import { MOCK_RATES_USD } from "@/lib/constants";

/**
 * Convert amount from one currency to another via USD bridge.
 * Rates are units of currency per 1 USD.
 */
export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<string, number> = MOCK_RATES_USD
): number {
  if (from === to) return amount;
  const fromRate = rates[from] ?? 1;
  const toRate = rates[to] ?? 1;
  const inUsd = amount / fromRate;
  return inUsd * toRate;
}

/** Exchange rate: how many units of `to` equal 1 unit of `from` */
export function getExchangeRate(
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<string, number> = MOCK_RATES_USD
): number {
  if (from === to) return 1;
  return convertCurrency(1, from, to, rates);
}

export function toBaseAmount(
  amountOriginal: number,
  currencyOriginal: CurrencyCode,
  currencyBase: CurrencyCode,
  rates: Record<string, number> = MOCK_RATES_USD
): { amountBase: number; exchangeRate: number } {
  const exchangeRate = getExchangeRate(currencyOriginal, currencyBase, rates);
  const precise = convertCurrency(amountOriginal, currencyOriginal, currencyBase, rates);
  return {
    amountBase: Math.round(precise * 100) / 100,
    exchangeRate: Math.round(exchangeRate * 10000) / 10000,
  };
}

export function sumTransactionsBase(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + t.amountBase, 0);
}

export function sumProtectedPockets(pockets: Pocket[]): number {
  return pockets.filter((p) => p.protected).reduce((sum, p) => sum + p.balance, 0);
}
