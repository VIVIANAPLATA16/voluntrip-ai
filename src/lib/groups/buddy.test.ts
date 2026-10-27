import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n/dictionaries";
import { findGroupTravelBuddies, formatBuddyReply } from "./buddy";
import type { GroupPublic, GroupSession, SyncedGroupMember } from "./types";

const ROCK = "urn:tag:genre:music:rock";
const COLOMBIANA = "urn:tag:genre:place:restaurant:colombian";
const SALSA = "urn:tag:genre:music:salsa";
const SECRET = "ab".repeat(16);
const SELF_ID = "11111111-1111-4111-8111-111111111111";
const ANA_ID = "22222222-2222-4222-8222-222222222222";
const BO_ID = "33333333-3333-4333-8333-333333333333";

const session: GroupSession = {
  groupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  memberId: SELF_ID,
  secret: SECRET,
  code: "ABCD2345",
};

function member(
  id: string,
  alias: string,
  tags: string[]
): SyncedGroupMember {
  return { id, alias, tags, entities: [], source: "synced" };
}

function group(members: SyncedGroupMember[]): GroupPublic {
  return {
    id: session.groupId,
    code: session.code,
    name: "Trip",
    expiresAt: "2026-11-02T00:00:00.000Z",
    members,
  };
}

function deps(input: {
  session?: GroupSession | null;
  status?: "ok" | "not_found" | "unavailable";
  members?: SyncedGroupMember[];
}) {
  return {
    loadSession: async function () {
      return input.session === undefined ? session : input.session;
    },
    readGroup: async function () {
      if (input.status && input.status !== "ok") return { status: input.status };
      return { status: "ok" as const, group: group(input.members ?? []) };
    },
  };
}

function assertPrivate(text: string) {
  expect(text).not.toContain(SECRET);
  expect(text).not.toContain(SELF_ID);
  expect(text).not.toContain(ANA_ID);
  expect(text).not.toContain(BO_ID);
  expect(text.toLowerCase()).not.toContain("memberid");
  expect(text.toLowerCase()).not.toContain("secret");
}

describe("findGroupTravelBuddies", () => {
  it("asks the traveler to create or join a group when none is active", async () => {
    const found = await findGroupTravelBuddies(deps({ session: null }));
    expect(found).toEqual({ kind: "no_group" });
    const text = formatBuddyReply("en", found);
    expect(text).toBe(t("en", "navi.buddy.no_group"));
    assertPrivate(text);
  });

  it("says the group could not be read when it is expired or unreachable", async () => {
    expect(await findGroupTravelBuddies(deps({ status: "not_found" }))).toEqual({
      kind: "unavailable",
    });
    expect(await findGroupTravelBuddies(deps({ status: "unavailable" }))).toEqual({
      kind: "unavailable",
    });
    const text = formatBuddyReply("es", { kind: "unavailable" });
    expect(text).toBe(t("es", "navi.buddy.unavailable"));
    assertPrivate(text);
  });

  it("says nobody is sharing when the current user also has no tags", async () => {
    const found = await findGroupTravelBuddies(
      deps({
        members: [
          member(SELF_ID, "Viv", []),
          member(BO_ID, "Bo", []),
        ],
      })
    );
    expect(found).toEqual({ kind: "none_sharing", code: "ABCD2345" });
    const text = formatBuddyReply("es", found);
    expect(text).toBe(t("es", "navi.buddy.none_sharing", { code: "ABCD2345" }));
    expect(text).toMatch(/ni siquiera tú/i);
    assertPrivate(text);
  });

  it("says only the current member is sharing when nobody else shared tags", async () => {
    const found = await findGroupTravelBuddies(
      deps({
        members: [
          member(SELF_ID, "Viv", [ROCK, COLOMBIANA]),
          member(BO_ID, "Bo", []),
        ],
      })
    );
    expect(found).toEqual({ kind: "only_self", code: "ABCD2345" });
    expect(
      await findGroupTravelBuddies(deps({ members: [member(SELF_ID, "Viajera 1", [ROCK])] }))
    ).toEqual({ kind: "only_self", code: "ABCD2345" });
    const en = formatBuddyReply("en", found);
    const es = formatBuddyReply("es", found);
    const pt = formatBuddyReply("pt", found);
    expect(en).toBe(t("en", "navi.buddy.only_self", { code: "ABCD2345" }));
    expect(es).toBe(t("es", "navi.buddy.only_self", { code: "ABCD2345" }));
    expect(pt).toBe(t("pt", "navi.buddy.only_self", { code: "ABCD2345" }));
    expect(en).not.toMatch(/no one in this group is sharing/i);
    expect(es).not.toMatch(/nadie en este grupo está compartiendo gustos culturales, ni siquiera tú/i);
    expect(en).not.toContain("Bo");
    assertPrivate(en);
    assertPrivate(es);
    assertPrivate(pt);
  });

  it("does not claim a match when other members share tastes that do not overlap", async () => {
    const found = await findGroupTravelBuddies(
      deps({
        members: [
          member(SELF_ID, "Viv", [ROCK]),
          member(ANA_ID, "Ana", [SALSA]),
        ],
      })
    );
    expect(found).toEqual({ kind: "no_match", code: "ABCD2345" });
    const text = formatBuddyReply("pt", found);
    expect(text).toBe(t("pt", "navi.buddy.no_match", { code: "ABCD2345" }));
    expect(text).toMatch(/há membros compartilhando/i);
    expect(text).not.toMatch(/Ana/i);
    assertPrivate(text);
  });

  it("returns real aliases and overlapping shared tastes only", async () => {
    const found = await findGroupTravelBuddies(
      deps({
        members: [
          member(SELF_ID, "Viv", [ROCK, COLOMBIANA]),
          member(ANA_ID, "Ana", [ROCK, SALSA]),
          member(BO_ID, "Bo", []),
        ],
      })
    );
    expect(found.kind).toBe("matches");
    if (found.kind !== "matches") return;
    expect(found.members).toEqual([{ alias: "Ana", tags: [ROCK] }]);
    expect(found.common).toEqual([ROCK]);
    const text = formatBuddyReply("en", found);
    expect(text).toContain("Ana");
    expect(text).toMatch(/rock/i);
    expect(text).not.toContain("Bo");
    expect(text).not.toContain("Viv");
    expect(text).not.toMatch(/salsa/i);
    expect(text).not.toMatch(/available today|accepted|agreed to go/i);
    assertPrivate(text);
  });

  it("never puts secrets or member ids in localized replies", () => {
    for (const locale of ["en", "es", "pt"] as const) {
      assertPrivate(formatBuddyReply(locale, { kind: "no_group" }));
      assertPrivate(
        formatBuddyReply(locale, { kind: "none_sharing", code: "ABCD2345" })
      );
      assertPrivate(
        formatBuddyReply(locale, { kind: "only_self", code: "ABCD2345" })
      );
      assertPrivate(
        formatBuddyReply(locale, { kind: "no_match", code: "ABCD2345" })
      );
      assertPrivate(
        formatBuddyReply(locale, {
          kind: "matches",
          code: "ABCD2345",
          members: [{ alias: "Ana", tags: [ROCK] }],
          common: [ROCK],
          almost: [],
        })
      );
    }
  });
});
