import { publicRpcPayload } from "./validate";
import type { GroupErrStatus, GroupFunctionName, GroupPublic } from "./types";

const KNOWN_RPC_STATUSES: GroupErrStatus[] = [
  "invalid_code",
  "invalid_alias",
  "invalid_tags",
  "invalid_entities",
  "unauthorized",
  "alias_taken",
  "group_full",
  "not_found",
  "code_taken",
];

export type GroupRpcOk = {
  ok: true;
  group?: GroupPublic;
  memberId?: string;
  left?: boolean;
};

export type GroupRpcResult = GroupRpcOk | { ok: false; status: GroupErrStatus };

export function groupsAnonConfig(): { url: string; anon: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;
  return { url: url.replace(/\/$/, ""), anon };
}

function mapRpcError(payload: unknown, httpStatus: number): GroupErrStatus {
  if (httpStatus === 404 || httpStatus === 502 || httpStatus === 503) return "unavailable";
  if (!payload || typeof payload !== "object") return "unavailable";
  const record = payload as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message : "";
  const code = typeof record.code === "string" ? record.code : "";
  if (code === "PGRST202" || /does not exist|schema cache/i.test(message)) {
    return "unavailable";
  }
  const token = message.split(/\s+/)[0];
  const fromToken = KNOWN_RPC_STATUSES.find(function (status) {
    return status === token || status === message;
  });
  return fromToken ?? "unavailable";
}

export async function invokeGroupFunction(
  name: GroupFunctionName,
  params: Record<string, unknown>
): Promise<GroupRpcResult> {
  const cfg = groupsAnonConfig();
  if (!cfg) return { ok: false, status: "unavailable" };

  let res: Response;
  try {
    res = await fetch(`${cfg.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: cfg.anon,
        Authorization: `Bearer ${cfg.anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
  } catch {
    return { ok: false, status: "unavailable" };
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    return { ok: false, status: "unavailable" };
  }

  if (!res.ok) {
    return { ok: false, status: mapRpcError(payload, res.status) };
  }

  if (name === "leave_group") {
    if (payload && typeof payload === "object" && (payload as { ok?: unknown }).ok === true) {
      return { ok: true, left: true };
    }
    return { ok: false, status: "unavailable" };
  }

  const parsed = publicRpcPayload(payload);
  if (!parsed) return { ok: false, status: "unavailable" };
  return { ok: true, group: parsed.group, memberId: parsed.memberId };
}
