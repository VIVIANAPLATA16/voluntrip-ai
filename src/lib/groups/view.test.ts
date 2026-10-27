import { describe, expect, it, vi } from "vitest";
import { t } from "@/lib/i18n/dictionaries";
import { groupErrorText, groupsGate } from "./share";

const { isCloudConfigured } = vi.hoisted(function () {
  return { isCloudConfigured: vi.fn() };
});

vi.mock("@/lib/supabase/client", function () {
  return { isCloudConfigured };
});

describe("groups screen gates", () => {
  it("shows a cloud-needed state when Supabase is not configured", () => {
    isCloudConfigured.mockReturnValue(false);
    expect(groupsGate({ cloud: isCloudConfigured(), offline: false })).toBe("needs_cloud");
    expect(t("es", "groups.needs_cloud")).toBe(
      "Groups necesita copia en la nube y conexión a internet."
    );
    expect(groupErrorText("en", "unavailable")).toBe("Groups is unavailable right now.");
  });

  it("shows offline and server errors without inventing members", () => {
    isCloudConfigured.mockReturnValue(true);
    expect(groupsGate({ cloud: isCloudConfigured(), offline: true })).toBe("offline");
    expect(groupsGate({ cloud: isCloudConfigured(), offline: false })).toBe("ok");
    expect(groupErrorText("es", "invalid_code")).toBe("Ese código de invitación no es válido.");
    expect(groupErrorText("en", "unavailable")).not.toMatch(/member|secret/i);
  });
});
