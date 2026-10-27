import { handleUpdateMember } from "@/lib/groups/handlers";
import { groupJson, readGroupJsonBody } from "@/lib/groups/http";

/** POST /api/groups/update — update my tastes. Body: { groupId, memberId, secret, alias, tags, entities } */
export async function POST(request: Request) {
  const body = await readGroupJsonBody(request);
  if (!body.ok) return groupJson({ status: body.status });
  return groupJson(await handleUpdateMember(body.value));
}
