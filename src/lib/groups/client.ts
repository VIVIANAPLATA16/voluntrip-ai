import { getMeta, setMeta } from "@/lib/db/indexeddb";
import { groupOverlap } from "./overlap";
import { GROUP_META_KEY, type GroupResult, type GroupSession } from "./types";

export type GroupConsentInput = {
  consentGranted: boolean;
};

export type GroupTasteInput = GroupConsentInput & {
  alias: string;
  tags: string[];
  entities: Array<{ id: string; name: string; type: string }>;
};

function generateMemberSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, function (byte) {
    return byte.toString(16).padStart(2, "0");
  }).join("");
}

function asSession(value: unknown): GroupSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.groupId !== "string" ||
    typeof record.memberId !== "string" ||
    typeof record.secret !== "string" ||
    typeof record.code !== "string"
  ) {
    return null;
  }
  return {
    groupId: record.groupId,
    memberId: record.memberId,
    secret: record.secret,
    code: record.code,
  };
}

export async function loadGroupSession(): Promise<GroupSession | null> {
  return asSession(await getMeta(GROUP_META_KEY));
}

export async function saveGroupSession(session: GroupSession): Promise<void> {
  await setMeta(GROUP_META_KEY, session);
}

export async function clearGroupSession(): Promise<void> {
  await setMeta(GROUP_META_KEY, null);
}

async function postGroup(path: string, body: unknown): Promise<GroupResult> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: "unavailable" };
  }
  try {
    const payload = (await res.json()) as GroupResult;
    if (!payload || typeof payload !== "object" || typeof payload.status !== "string") {
      return { status: "unavailable" };
    }
    return payload;
  } catch {
    return { status: "unavailable" };
  }
}

function withOverlap(result: GroupResult): GroupResult {
  if (result.status !== "ok") return result;
  return result;
}

export async function createSharedGroup(input: GroupTasteInput): Promise<GroupResult> {
  if (!input.consentGranted) return { status: "no_consent" };
  const secret = generateMemberSecret();
  const result = await postGroup("/api/groups", {
    alias: input.alias,
    tags: input.tags,
    entities: input.entities,
    secret,
  });
  if (result.status === "ok" && result.memberId) {
    await saveGroupSession({
      groupId: result.group.id,
      memberId: result.memberId,
      secret,
      code: result.group.code,
    });
  }
  return withOverlap(result);
}

export async function joinSharedGroup(
  input: GroupTasteInput & { code: string }
): Promise<GroupResult> {
  if (!input.consentGranted) return { status: "no_consent" };
  const secret = generateMemberSecret();
  const result = await postGroup("/api/groups/join", {
    code: input.code,
    alias: input.alias,
    tags: input.tags,
    entities: input.entities,
    secret,
  });
  if (result.status === "ok" && result.memberId) {
    await saveGroupSession({
      groupId: result.group.id,
      memberId: result.memberId,
      secret,
      code: result.group.code,
    });
  }
  return withOverlap(result);
}

export async function readSharedGroup(): Promise<GroupResult> {
  const session = await loadGroupSession();
  if (!session) return { status: "not_found" };
  return postGroup("/api/groups/read", { code: session.code });
}

export async function updateSharedGroupTastes(
  input: GroupTasteInput
): Promise<GroupResult> {
  if (!input.consentGranted) return { status: "no_consent" };
  const session = await loadGroupSession();
  if (!session) return { status: "not_found" };
  return postGroup("/api/groups/update", {
    groupId: session.groupId,
    memberId: session.memberId,
    secret: session.secret,
    alias: input.alias,
    tags: input.tags,
    entities: input.entities,
  });
}

export async function leaveSharedGroup(): Promise<{ status: "ok" } | GroupResult> {
  const session = await loadGroupSession();
  if (!session) return { status: "not_found" };
  const result = await postGroup("/api/groups/leave", {
    groupId: session.groupId,
    memberId: session.memberId,
    secret: session.secret,
  });
  if (result.status === "ok") await clearGroupSession();
  return result;
}

export function overlapForResult(result: GroupResult) {
  if (result.status !== "ok") return { overlap: "none" as const, tags: [], entities: [] };
  return groupOverlap(result.group.members);
}
