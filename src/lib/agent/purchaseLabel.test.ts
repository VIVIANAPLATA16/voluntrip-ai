import { describe, expect, it } from "vitest";
import {
  GENERIC_PURCHASE_LABEL,
  PLACE_LABEL_MAX,
  confirmedPurchaseInput,
  extractPlaceFromWhatIf,
  formatConfirmedPurchaseMessage,
  formatExperiencePlaceLabel,
  isWrittenConfirm,
  purchaseConceptFromMessages,
  purchaseConceptFromUserText,
  sanitizePlaceLabel,
  whatIfSpendText,
} from "./purchaseLabel";

const sim = {
  purchaseAmount: 25,
  purchaseCurrency: "USD" as const,
};

const trip = {
  id: "trip-1",
  baseCurrency: "USD" as const,
};

describe("sanitizePlaceLabel", () => {
  it("strips HTML and never invents a name", () => {
    expect(sanitizePlaceLabel("<b>Fonda La Chismosa</b>")).toBe("Fonda La Chismosa");
    expect(sanitizePlaceLabel("   ")).toBeNull();
    expect(sanitizePlaceLabel("<script>alert(1)</script>")).toBe("alert(1)");
    expect(sanitizePlaceLabel(undefined)).toBeNull();
  });

  it("truncates a very long name", () => {
    const long = "A".repeat(200);
    const sanitized = sanitizePlaceLabel(long);
    expect(sanitized).toHaveLength(PLACE_LABEL_MAX);
    expect(sanitized).toBe("A".repeat(PLACE_LABEL_MAX));
  });
});

describe("what-if place label", () => {
  it("puts the simulated place in the What if text", () => {
    expect(whatIfSpendText(25.4, "Fonda La Chismosa - La 70")).toBe(
      "What if I spend $25 at Fonda La Chismosa - La 70?"
    );
  });

  it("keeps the current What if text when there is no place", () => {
    expect(whatIfSpendText(25)).toBe("What if I spend $25?");
    expect(whatIfSpendText(25, "")).toBe("What if I spend $25?");
  });

  it("extracts the place from a What if line and falls back to Purchase", () => {
    expect(extractPlaceFromWhatIf("What if I spend $25 at Fonda La Chismosa - La 70?")).toBe(
      "Fonda La Chismosa - La 70"
    );
    expect(extractPlaceFromWhatIf("What if I spend $25?")).toBeNull();
    expect(purchaseConceptFromUserText("What if I spend $25 at Fonda La Chismosa - La 70?")).toBe(
      "Fonda La Chismosa - La 70"
    );
    expect(purchaseConceptFromUserText("What if I spend $25?")).toBe(GENERIC_PURCHASE_LABEL);
  });

  it("joins name and neighborhood without inventing either", () => {
    expect(
      formatExperiencePlaceLabel({ name: "Fonda La Chismosa", neighborhood: "La 70" })
    ).toBe("Fonda La Chismosa - La 70");
    expect(formatExperiencePlaceLabel({ name: "Fonda La Chismosa" })).toBe("Fonda La Chismosa");
  });
});

describe("confirmed purchase label", () => {
  it("uses the place name in the Activity concept and NAVI message", () => {
    const userText = "What if I spend $25 at Fonda La Chismosa - La 70?";
    const input = confirmedPurchaseInput(sim, trip, userText);
    expect(input.concept).toBe("Fonda La Chismosa - La 70");
    expect(input.amountOriginal).toBe(25);
    expect(input.currencyOriginal).toBe("USD");
    expect(input.currencyBase).toBe("USD");
    expect(input.category).toBe("general");
    expect(formatConfirmedPurchaseMessage("en", sim, input.concept)).toBe(
      'Purchase confirmed: $25.00 USD for "Fonda La Chismosa - La 70"'
    );
  });

  it("keeps the current Purchase label and no extra message without a place", () => {
    const userText = "What if I spend $25?";
    const input = confirmedPurchaseInput(sim, trip, userText);
    expect(input.concept).toBe(GENERIC_PURCHASE_LABEL);
    expect(input.amountOriginal).toBe(sim.purchaseAmount);
    expect(formatConfirmedPurchaseMessage("en", sim, input.concept)).toBeNull();
  });

  it("keeps Cafe at the Park as one place name", () => {
    expect(extractPlaceFromWhatIf("What if I spend $12 at Cafe at the Park?")).toBe(
      "Cafe at the Park"
    );
  });

  it("finds the place on the current simulation after confirm or another question", () => {
    const messages = [
      { role: "user", content: "What if I spend $25 at Fonda La Chismosa - La 70?" },
      { role: "assistant", content: "Here's the simulation." },
      { role: "user", content: "why this?" },
      { role: "assistant", content: "Why Fonda La Chismosa:" },
      { role: "user", content: "confirm" },
    ];
    expect(purchaseConceptFromMessages(messages, sim)).toBe("Fonda La Chismosa - La 70");
    expect(isWrittenConfirm("confirm")).toBe(true);
    expect(isWrittenConfirm("Confirmar")).toBe(true);
    expect(isWrittenConfirm("What if I spend $25?")).toBe(false);
  });

  it("uses the generic label when the current simulation had no place", () => {
    const messages = [
      { role: "user", content: "What if I spend $25 at El Social Salsa?" },
      { role: "user", content: "What if I spend $40?" },
    ];
    expect(
      purchaseConceptFromMessages(messages, { purchaseAmount: 40, purchaseCurrency: "USD" })
    ).toBe(GENERIC_PURCHASE_LABEL);
  });

  it("does not change the simulated amounts", () => {
    const withPlace = confirmedPurchaseInput(
      { purchaseAmount: 60, purchaseCurrency: "USD" },
      trip,
      "What if I spend $60 at El Social Salsa?"
    );
    const withoutPlace = confirmedPurchaseInput(
      { purchaseAmount: 60, purchaseCurrency: "USD" },
      trip,
      "What if I spend $60?"
    );
    expect(withPlace.amountOriginal).toBe(60);
    expect(withoutPlace.amountOriginal).toBe(60);
    expect(withPlace.amountOriginal).toBe(withoutPlace.amountOriginal);
  });
});
