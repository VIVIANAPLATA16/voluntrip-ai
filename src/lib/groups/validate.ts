import {
  GROUP_ALIAS_MAX,
  GROUP_CODE_ALPHABET,
  GROUP_CODE_LENGTH,
  GROUP_ENTITY_NAME_MAX,
  GROUP_ENTITY_TYPE_MAX,
  GROUP_MAX_ENTITIES,
  GROUP_MAX_TAGS,
  GROUP_STATUSES,
  GROUP_TAG_MAX,
  type GroupEntity,
  type GroupPublic,
  type GroupErrStatus,
  type GroupStatus,
  type SyncedGroupMember,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_RE = /^[a-f0-9]{64}$/;
const CODE_RE = new RegExp(`^[${GROUP_CODE_ALPHABET}]{${GROUP_CODE_LENGTH}}$`);

export function isGroupStatus(value: unknown): value is GroupStatus {
  return typeof value === "string" && (GROUP_STATUSES as readonly string[]).includes(value);
}

export function extraKeys(obj: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(obj).filter(function (key) {
    return !allowed.includes(key);
  });
}

export function validateAlias(value: unknown): { ok: true; alias: string } | { ok: false } {
  if (typeof value !== "string") return { ok: false };
  const alias = value.trim();
  if (alias.length < 1 || alias.length > GROUP_ALIAS_MAX) return { ok: false };
  if (/[<>]/.test(alias)) return { ok: false };
  return { ok: true, alias };
}

export function validateGroupCode(value: unknown): { ok: true; code: string } | { ok: false } {
  if (typeof value !== "string") return { ok: false };
  const code = value.trim().toUpperCase();
  if (!CODE_RE.test(code)) return { ok: false };
  return { ok: true, code };
}

export function validateSecret(value: unknown): { ok: true; secret: string } | { ok: false } {
  if (typeof value !== "string" || value.length < 16 || value.length > 128) return { ok: false };
  if (!/^[a-f0-9]+$/i.test(value)) return { ok: false };
  return { ok: true, secret: value.toLowerCase() };
}

export function validateSecretHash(value: unknown): { ok: true; hash: string } | { ok: false } {
  if (typeof value !== "string" || !HASH_RE.test(value)) return { ok: false };
  return { ok: true, hash: value };
}

export function validateUuid(value: unknown): { ok: true; id: string } | { ok: false } {
  if (typeof value !== "string" || !UUID_RE.test(value)) return { ok: false };
  return { ok: true, id: value.toLowerCase() };
}

export function validateTags(value: unknown): { ok: true; tags: string[] } | { ok: false } {
  if (!Array.isArray(value) || value.length > GROUP_MAX_TAGS) return { ok: false };
  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return { ok: false };
    const tag = item.trim();
    if (tag.length < 9 || tag.length > GROUP_TAG_MAX) return { ok: false };
    if (!tag.startsWith("urn:tag:")) return { ok: false };
    tags.push(tag);
  }
  return { ok: true, tags };
}

export function validateEntities(
  value: unknown
): { ok: true; entities: GroupEntity[] } | { ok: false } {
  if (!Array.isArray(value) || value.length > GROUP_MAX_ENTITIES) return { ok: false };
  const entities: GroupEntity[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false };
    const record = item as Record<string, unknown>;
    if (extraKeys(record, ["id", "name", "type"]).length > 0) return { ok: false };
    const id = validateUuid(record.id);
    if (!id.ok) return { ok: false };
    if (typeof record.name !== "string") return { ok: false };
    const name = record.name.trim();
    if (name.length < 1 || name.length > GROUP_ENTITY_NAME_MAX || /[<>]/.test(name)) {
      return { ok: false };
    }
    if (typeof record.type !== "string") return { ok: false };
    const type = record.type.trim();
    if (type.length < 1 || type.length > GROUP_ENTITY_TYPE_MAX) return { ok: false };
    entities.push({ id: id.id, name, type });
  }
  return { ok: true, entities };
}

export function parseTasteBody(
  body: unknown,
  allowed: readonly string[]
):
  | {
      ok: true;
      alias: string;
      tags: string[];
      entities: GroupEntity[];
      extra: Record<string, unknown>;
    }
  | { ok: false; status: GroupErrStatus } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: "extra_fields" };
  }
  const record = body as Record<string, unknown>;
  if (extraKeys(record, allowed).length > 0) return { ok: false, status: "extra_fields" };
  const alias = validateAlias(record.alias);
  if (!alias.ok) return { ok: false, status: "invalid_alias" };
  const tags = validateTags(record.tags ?? []);
  if (!tags.ok) return { ok: false, status: "invalid_tags" };
  const entities = validateEntities(record.entities ?? []);
  if (!entities.ok) return { ok: false, status: "invalid_entities" };
  return { ok: true, alias: alias.alias, tags: tags.tags, entities: entities.entities, extra: record };
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    out.push(item);
  }
  return out;
}

function asEntities(value: unknown): GroupEntity[] | null {
  const parsed = validateEntities(value ?? []);
  return parsed.ok ? parsed.entities : null;
}

export function publicMember(raw: unknown): SyncedGroupMember | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id = validateUuid(record.id);
  const alias = validateAlias(record.alias);
  const tags = asStringArray(record.tags);
  const entities = asEntities(record.entities);
  if (!id.ok || !alias.ok || !tags || !entities) return null;
  if (record.source !== "synced") return null;
  if ("secret" in record || "secret_hash" in record || "secretHash" in record) return null;
  return {
    id: id.id,
    alias: alias.alias,
    tags,
    entities,
    source: "synced",
  };
}

export function publicGroup(raw: unknown): GroupPublic | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id = validateUuid(record.id);
  const code = validateGroupCode(record.code);
  if (!id.ok || !code.ok) return null;
  if (typeof record.name !== "string") return null;
  const expiresAt =
    typeof record.expiresAt === "string"
      ? record.expiresAt
      : typeof record.expires_at === "string"
        ? record.expires_at
        : null;
  if (!expiresAt) return null;
  if (!Array.isArray(record.members)) return null;
  const members: SyncedGroupMember[] = [];
  for (const item of record.members) {
    const member = publicMember(item);
    if (!member) return null;
    members.push(member);
  }
  return {
    id: id.id,
    code: code.code,
    name: record.name,
    expiresAt,
    members,
  };
}

export function publicRpcPayload(
  data: unknown
): { group: GroupPublic; memberId?: string } | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if ("secret" in record || "secret_hash" in record || "secretHash" in record) return null;
  const group = publicGroup(record.group);
  if (!group) return null;
  let memberId: string | undefined;
  if (record.memberId !== undefined) {
    const parsed = validateUuid(record.memberId);
    if (!parsed.ok) return null;
    memberId = parsed.id;
  } else if (record.member_id !== undefined) {
    const parsed = validateUuid(record.member_id);
    if (!parsed.ok) return null;
    memberId = parsed.id;
  }
  return { group, memberId };
}
