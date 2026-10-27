import { handleLeaveGroup } from "@/lib/groups/handlers";
import { groupJson, readGroupJsonBody } from "@/lib/groups/http";

/** POST /api/groups/leave — leave a group. Body: { groupId, memberId, secret } */
export async function POST(request: Request) {
  const body = await readGroupJsonBody(request);
  if (!body.ok) return groupJson({ status: body.status });
  return groupJson(await handleLeaveGroup(body.value));
}
