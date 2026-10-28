import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n/dictionaries";
import { localizedDemoInsight } from "./insightCopy";
import type { AIInsight } from "@/types";

const stored: AIInsight = {
  id: "insight-sg-1",
  tripId: "demo-trip-singapore",
  type: "info",
  title: "Singapore tonight",
  message: "You have $1800 real available and 9 days left. Ask NAVI what to do tonight.",
  createdAt: "2026-10-28T00:00:00.000Z",
};

describe("localizedDemoInsight", () => {
  it("keeps the stored English copy and localizes at render for es and pt", () => {
    const es = localizedDemoInsight(stored, "es", 1800, 9);
    expect(stored.message).toMatch(/You have \$1800/);
    expect(es.title).toBe(t("es", "demo.insight.singapore_title"));
    expect(es.message).toBe(t("es", "demo.insight.body", { available: 1800, days: 9 }));
    expect(es.message).not.toMatch(/You have/);
    expect(localizedDemoInsight(stored, "pt", 1800, 9).title).toBe(
      t("pt", "demo.insight.singapore_title")
    );
  });

  it("leaves live insights unchanged", () => {
    const live: AIInsight = { ...stored, id: "live-insight", title: "Live", message: "From NAVI" };
    expect(localizedDemoInsight(live, "es", 1800, 9)).toEqual(live);
  });
});
