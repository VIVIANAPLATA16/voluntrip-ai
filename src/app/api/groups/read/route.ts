import { handleReadGroup } from "@/lib/groups/handlers";
import { allowGroupAttempt, groupClientIp, groupJson, readGroupJsonBody } from "@/lib/groups/http";

/** POST /api/groups/read — read a live group. Body: { code } */
export async function POST(request: Request) {
  if (!allowGroupAttempt("read", groupClientIp(request))) {
    return groupJson({ status: "rate_limited" });
  }
  const body = await readGroupJsonBody(request);
  if (!body.ok) return groupJson({ status: body.status });
  return groupJson(await handleReadGroup(body.value));
}
