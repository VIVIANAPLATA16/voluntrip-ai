import { describe, expect, it } from "vitest";
import {
  extraKeys,
  parseTasteBody,
  publicMember,
  publicRpcPayload,
  validateAlias,
  validateEntities,
  validateGroupCode,
  validateTags,
} from "./validate";

const ENTITY = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Bad Bunny",
  type: "urn:entity:artist",
};

describe("group validation", () => {
  it("rejects HTML in aliases and extra entity keys", () => {
    expect(validateAlias("<script>")).toEqual({ ok: false });
    expect(validateAlias("Ana")).toEqual({ ok: true, alias: "Ana" });
    expect(validateAlias("x".repeat(25))).toEqual({ ok: false });
    expect(validateEntities([{ ...ENTITY, email: "a@b.c" }])).toEqual({ ok: false });
    expect(validateEntities([ENTITY]).ok).toBe(true);
    expect(validateTags(["not-a-urn"])).toEqual({ ok: false });
    expect(validateTags(["urn:tag:genre:music:salsa"]).ok).toBe(true);
    expect(validateGroupCode("OIL10ABC")).toEqual({ ok: false });
    expect(validateGroupCode("ABCD2345").ok).toBe(true);
    expect(extraKeys({ alias: "A", email: "x" }, ["alias"])).toEqual(["email"]);
  });

  it("rejects extra fields on taste bodies", () => {
    const parsed = parseTasteBody(
      { alias: "Ana", tags: [], entities: [], secret: "aa".repeat(16), email: "x" },
      ["alias", "tags", "entities", "secret"]
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.status).toBe("extra_fields");
  });

  it("drops leaked secrets from public payloads", () => {
    expect(
      publicMember({
        id: ENTITY.id,
        alias: "Ana",
        tags: [],
        entities: [],
        source: "synced",
        secret_hash: "abc",
      })
    ).toBeNull();
    expect(
      publicRpcPayload({
        group: {
          id: ENTITY.id,
          code: "ABCD2345",
          name: "Ana",
          expiresAt: "2026-11-02T00:00:00.000Z",
          members: [],
        },
        secret_hash: "nope",
      })
    ).toBeNull();
  });
});
