import { describe, expect, it } from "vitest";
import type { CulturalProfile } from "@/types";
import {
  TASTE_PROFILE_PATH,
  TASTE_PROFILE_SECTIONS,
  buildTasteSummary,
  lovedEntityNames,
} from "./TasteSummaryCard";
import { CulturalDnaCard } from "./CulturalDnaCard";
import { LovedEntitiesField } from "./LovedEntitiesField";
import { t } from "@/lib/i18n/dictionaries";

const ENTITY_UUID = "550e8400-e29b-41d4-a716-446655440000";

function profile(partial: Partial<CulturalProfile> = {}): CulturalProfile {
  return {
    id: "default",
    consent: { granted: false, grantedAt: null },
    music: [],
    food: [],
    entertainment: [],
    activities: [],
    updatedAt: "2026-10-26T00:00:00.000Z",
    ...partial,
  };
}

describe("TasteSummaryCard model", () => {
  it("shows loved-entity names and never UUIDs", () => {
    const names = lovedEntityNames([
      { id: ENTITY_UUID, name: "Bad Bunny", type: "urn:entity:artist" },
      { id: "other", name: ENTITY_UUID, type: "urn:entity:artist" },
    ]);
    expect(names).toEqual(["Bad Bunny"]);
    expect(names.join(" ")).not.toContain(ENTITY_UUID);

    const summary = buildTasteSummary(
      profile({
        consent: { granted: true, grantedAt: "2026-10-26T00:00:00.000Z" },
        music: [{ label: "salsa", qlooTagId: "urn:tag:genre:music:salsa" }],
        lovedEntities: [{ id: ENTITY_UUID, name: "Bad Bunny", type: "urn:entity:artist" }],
      })
    );
    expect(summary.entityNames).toEqual(["Bad Bunny"]);
    expect(summary.empty).toBe(false);
    expect(summary.likeCount).toBe(1);
  });

  it("uses the honest empty state and links to /app/profile", () => {
    const empty = buildTasteSummary(null);
    expect(empty.empty).toBe(true);
    expect(empty.href).toBe("/app/profile");
    expect(empty.href).toBe(TASTE_PROFILE_PATH);
    expect(t("es", "taste.summary.empty")).toBe(
      "Aún no hay Cultural DNA. Activa el consentimiento y elige un gusto"
    );
    expect(t("en", "taste.summary.empty")).toMatch(/No Cultural DNA yet/i);
    expect(t("es", "taste.summary.edit")).toBe("Editar gustos");
  });
});

describe("taste profile page", () => {
  it("hosts consent and the loved-entity field on /app/profile", () => {
    expect(TASTE_PROFILE_PATH).toBe("/app/profile");
    expect(TASTE_PROFILE_SECTIONS).toEqual([
      "consent",
      "signals",
      "filter",
      "lovedEntities",
    ]);
    expect(typeof CulturalDnaCard).toBe("function");
    expect(typeof LovedEntitiesField).toBe("function");
    expect(t("es", "profile.taste_title")).toBe("Perfil de gustos");
    expect(t("en", "profile.taste_title")).toBe("Taste profile");
    expect(t("pt", "profile.taste_title")).toBe("Perfil de gostos");
  });
});
