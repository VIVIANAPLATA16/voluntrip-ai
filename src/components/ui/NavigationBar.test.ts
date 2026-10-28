import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n/dictionaries";
import { MOBILE_NAV_TABS } from "./NavigationBar";

describe("mobile navigation tabs", () => {
  it("keeps five tabs with Groups next to the centered NAVI disc", () => {
    expect(MOBILE_NAV_TABS.map((tab) => tab.href)).toEqual([
      "/app",
      "/app/pockets",
      "/app/navi",
      "/app/groups",
      "/app/trip",
    ]);
    expect(MOBILE_NAV_TABS.filter((tab) => tab.center)).toHaveLength(1);
    expect(MOBILE_NAV_TABS.find((tab) => tab.center)?.href).toBe("/app/navi");
  });

  it("does not drop the Activity route; it is only off the tab bar", () => {
    expect(MOBILE_NAV_TABS.some((tab) => tab.href === "/app/activity")).toBe(false);
  });

  it("labels Groups in en, es, and pt", () => {
    expect(t("en", "nav.groups")).toBe("Groups");
    expect(t("es", "nav.groups")).toBe("Grupos");
    expect(t("pt", "nav.groups")).toBe("Grupos");
  });
});
