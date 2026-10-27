import { generateGroupCode, sha256Hex } from "./crypto";
import { invokeGroupFunction } from "./rpc";
import {
  extraKeys,
  parseTasteBody,
  validateGroupCode,
  validateSecret,
  validateUuid,
} from "./validate";
import type { GroupEntity, GroupLeaveResult, GroupResult } from "./types";

const CREATE_KEYS = ["alias", "tags", "entities", "secret"] as const;
const JOIN_KEYS = ["alias", "tags", "entities", "secret", "code"] as const;
const READ_KEYS = ["code"] as const;
const UPDATE_KEYS = ["groupId", "memberId", "secret", "alias", "tags", "entities"] as const;
const LEAVE_KEYS = ["groupId", "memberId", "secret"] as const;

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function hashOrInvalid(secret: unknown): { ok: true; hash: string } | { ok: false; status: "invalid_secret" } {
  const parsed = validateSecret(secret);
  if (!parsed.ok) return { ok: false, status: "invalid_secret" };
  return { ok: true, hash: sha256Hex(parsed.secret) };
}

async function createOnce(
  alias: string,
  tags: string[],
  entities: GroupEntity[],
  hash: string
): Promise<GroupResult> {
  const code = generateGroupCode();
  const rpc = await invokeGroupFunction("create_group", {
    p_code: code,
    p_alias: alias,
    p_tags: tags,
    p_entities: entities,
    p_secret_hash: hash,
  });
  if (!rpc.ok) return { status: rpc.status };
  if (!rpc.group || !rpc.memberId) return { status: "unavailable" };
  return { status: "ok", group: rpc.group, memberId: rpc.memberId };
}

export async function handleCreateGroup(body: unknown): Promise<GroupResult> {
  const record = asRecord(body);
  if (!record) return { status: "extra_fields" };
  if (extraKeys(record, CREATE_KEYS).length > 0) return { status: "extra_fields" };
  const parsed = parseTasteBody(record, CREATE_KEYS);
  if (!parsed.ok) return { status: parsed.status };
  const hashed = hashOrInvalid(record.secret);
  if (!hashed.ok) return { status: hashed.status };

  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await createOnce(parsed.alias, parsed.tags, parsed.entities, hashed.hash);
    if (result.status !== "code_taken") return result;
  }
  return { status: "unavailable" };
}

export async function handleJoinGroup(body: unknown): Promise<GroupResult> {
  const record = asRecord(body);
  if (!record) return { status: "extra_fields" };
  if (extraKeys(record, JOIN_KEYS).length > 0) return { status: "extra_fields" };
  const code = validateGroupCode(record.code);
  if (!code.ok) return { status: "invalid_code" };
  const parsed = parseTasteBody(record, JOIN_KEYS);
  if (!parsed.ok) return { status: parsed.status };
  const hashed = hashOrInvalid(record.secret);
  if (!hashed.ok) return { status: hashed.status };

  const rpc = await invokeGroupFunction("join_group", {
    p_code: code.code,
    p_alias: parsed.alias,
    p_tags: parsed.tags,
    p_entities: parsed.entities,
    p_secret_hash: hashed.hash,
  });
  if (!rpc.ok) return { status: rpc.status };
  if (!rpc.group || !rpc.memberId) return { status: "unavailable" };
  return { status: "ok", group: rpc.group, memberId: rpc.memberId };
}

export async function handleReadGroup(body: unknown): Promise<GroupResult> {
  const record = asRecord(body);
  if (!record) return { status: "extra_fields" };
  if (extraKeys(record, READ_KEYS).length > 0) return { status: "extra_fields" };
  const code = validateGroupCode(record.code);
  if (!code.ok) return { status: "invalid_code" };

  const rpc = await invokeGroupFunction("get_group", { p_code: code.code });
  if (!rpc.ok) return { status: rpc.status };
  if (!rpc.group) return { status: "unavailable" };
  return { status: "ok", group: rpc.group };
}

export async function handleUpdateMember(body: unknown): Promise<GroupResult> {
  const record = asRecord(body);
  if (!record) return { status: "extra_fields" };
  if (extraKeys(record, UPDATE_KEYS).length > 0) return { status: "extra_fields" };
  const groupId = validateUuid(record.groupId);
  const memberId = validateUuid(record.memberId);
  if (!groupId.ok || !memberId.ok) return { status: "not_found" };
  const parsed = parseTasteBody(record, UPDATE_KEYS);
  if (!parsed.ok) return { status: parsed.status };
  const hashed = hashOrInvalid(record.secret);
  if (!hashed.ok) return { status: hashed.status };

  const rpc = await invokeGroupFunction("update_member", {
    p_group_id: groupId.id,
    p_member_id: memberId.id,
    p_secret_hash: hashed.hash,
    p_alias: parsed.alias,
    p_tags: parsed.tags,
    p_entities: parsed.entities,
  });
  if (!rpc.ok) return { status: rpc.status };
  if (!rpc.group) return { status: "unavailable" };
  return { status: "ok", group: rpc.group, memberId: rpc.memberId ?? memberId.id };
}

export async function handleLeaveGroup(body: unknown): Promise<GroupLeaveResult> {
  const record = asRecord(body);
  if (!record) return { status: "extra_fields" };
  if (extraKeys(record, LEAVE_KEYS).length > 0) return { status: "extra_fields" };
  const groupId = validateUuid(record.groupId);
  const memberId = validateUuid(record.memberId);
  if (!groupId.ok || !memberId.ok) return { status: "not_found" };
  const hashed = hashOrInvalid(record.secret);
  if (!hashed.ok) return { status: hashed.status };

  const rpc = await invokeGroupFunction("leave_group", {
    p_group_id: groupId.id,
    p_member_id: memberId.id,
    p_secret_hash: hashed.hash,
  });
  if (!rpc.ok) return { status: rpc.status };
  return { status: "ok" };
}
