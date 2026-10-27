import { describe, expect, it } from "vitest";
import { tasteProfileAvatarProps } from "@/components/culture/TasteSummaryCard";
import { tasteHeaderAvatar } from "./HomeDashboard";

describe("dashboard Taste profile header control", () => {
  it("links to /app/profile with the localized aria-label and a decorative heart", () => {
    const es = tasteHeaderAvatar("es");
    expect(es).toEqual({
      href: "/app/profile",
      "aria-label": "Perfil de gustos",
      initial: null,
      icon: "heart",
      iconAriaHidden: true,
      circleClassName: es.circleClassName,
      circleBackground: es.circleBackground,
      heartClassName: es.heartClassName,
    });
    expect(tasteHeaderAvatar("en")).toEqual({
      ...tasteProfileAvatarProps("en"),
      initial: null,
      icon: "heart",
      iconAriaHidden: true,
      circleClassName: es.circleClassName,
      circleBackground: es.circleBackground,
      heartClassName: es.heartClassName,
    });
    expect(tasteHeaderAvatar("pt")["aria-label"]).toBe("Perfil de gostos");
    expect(es.initial).toBeNull();
    expect(es.icon).toBe("heart");
    expect(es.iconAriaHidden).toBe(true);
    expect(es.circleClassName).toContain("rounded-full");
    expect(es.circleClassName).toContain("h-11");
    expect(es.circleClassName).toContain("w-11");
    expect(es.circleClassName).toContain("font-display");
    expect(es.circleClassName).toContain("text-bg");
    expect(es.circleBackground).toMatch(/linear-gradient/);
    expect(es.circleBackground).toContain("hsl(168 70% 45%)");
    expect(es.circleBackground).toContain("hsl(198 60% 35%)");
    expect(es.heartClassName).toContain("h-5");
    expect(es.heartClassName).toContain("text-bg");
    expect(es.heartClassName).toContain("fill-current");
  });
});
