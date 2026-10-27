import { describe, expect, it } from "vitest";
import { tasteProfileAvatarProps } from "@/components/culture/TasteSummaryCard";
import { tasteHeaderAvatar } from "./HomeDashboard";

describe("dashboard Taste profile header control", () => {
  it("links to /app/profile with the localized aria-label and a decorative heart", () => {
    expect(tasteHeaderAvatar("es")).toEqual({
      href: "/app/profile",
      "aria-label": "Perfil de gustos",
      initial: null,
      icon: "heart",
      iconAriaHidden: true,
    });
    expect(tasteHeaderAvatar("en")).toEqual({
      ...tasteProfileAvatarProps("en"),
      initial: null,
      icon: "heart",
      iconAriaHidden: true,
    });
    expect(tasteHeaderAvatar("pt")["aria-label"]).toBe("Perfil de gostos");
    expect(tasteHeaderAvatar("es").initial).toBeNull();
    expect(tasteHeaderAvatar("es").icon).toBe("heart");
  });
});
