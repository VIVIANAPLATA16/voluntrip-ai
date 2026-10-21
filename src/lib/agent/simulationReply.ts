import type { PurchaseSimulation } from "@/types";
import { formatMoney } from "@/lib/constants";
import { t, type Locale } from "@/lib/i18n/dictionaries";

function localizeSimulationImpact(
  simulation: PurchaseSimulation,
  locale: Locale,
  base: string
): string {
  if (!simulation.affordable) {
    const shortfall =
      Math.round((simulation.purchaseAmountBase - simulation.availableBefore) * 100) / 100;
    return t(locale, "navi.sim_impact_unaffordable", {
      shortfall: formatMoney(shortfall, base, { showCode: true }),
    });
  }
  const dailyDrop =
    simulation.dailyBudgetBefore > 0
      ? (simulation.dailyBudgetBefore - simulation.dailyBudgetAfter) /
        simulation.dailyBudgetBefore
      : 0;
  if (dailyDrop > 0.25) {
    return t(locale, "navi.sim_impact_tight", { days: simulation.daysImpacted });
  }
  return t(locale, "navi.sim_impact_ok");
}

/** Reply text built from the same simulation object the Confirm card uses. */
export function simulationReply(
  locale: Locale,
  simulation: PurchaseSimulation,
  baseCurrency: string
): string {
  return t(locale, "navi.simulation_body", {
    availableBefore: formatMoney(simulation.availableBefore, baseCurrency, { showCode: true }),
    dailyBefore: formatMoney(simulation.dailyBudgetBefore, baseCurrency),
    weeklyBefore: formatMoney(simulation.weeklyBudgetBefore, baseCurrency),
    availableAfter: formatMoney(simulation.availableAfter, baseCurrency, { showCode: true }),
    dailyAfter: formatMoney(simulation.dailyBudgetAfter, baseCurrency),
    weeklyAfter: formatMoney(simulation.weeklyBudgetAfter, baseCurrency),
    impact: localizeSimulationImpact(simulation, locale, baseCurrency),
  });
}
