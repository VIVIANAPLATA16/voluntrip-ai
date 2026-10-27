import { handleJoinGroup } from "@/lib/groups/handlers";
import { allowGroupAttempt, groupClientIp, groupJson, readGroupJsonBody } from "@/lib/groups/http";

/** POST /api/groups/join — join by code. Body: { code, alias, tags, entities, secret } */
export async function POST(request: Request) {
  if (!allowGroupAttempt("join", groupClientIp(request))) {
    return groupJson({ status: "rate_limited" });
  }
  const body = await readGroupJsonBody(request);
  if (!body.ok) return groupJson({ status: body.status });
  return groupJson(await handleJoinGroup(body.value));
}
