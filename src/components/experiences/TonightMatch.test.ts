import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n/dictionaries";
import { TONIGHT_EMPTY_PROFILE_HREF } from "./TonightMatch";

describe("Tonight empty state without consent", () => {
  it("sends the traveler to Taste profile and does not grant consent", () => {
    expect(TONIGHT_EMPTY_PROFILE_HREF).toBe("/app/profile");
    expect(t("en", "tonight.open_profile")).toBe("Open Taste profile");
    expect(t("es", "tonight.open_profile")).toBe("Abrir perfil de gustos");
    expect(t("pt", "tonight.open_profile")).toBe("Abrir perfil de gostos");
    expect(t("en", "tonight.empty_consent")).toMatch(/consent/i);
    expect(t("es", "tonight.empty_consent")).toMatch(/consentimiento/i);
    expect(t("pt", "tonight.empty_consent")).toMatch(/consentimento/i);
  });
});
