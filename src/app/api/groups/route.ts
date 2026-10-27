import { handleCreateGroup } from "@/lib/groups/handlers";
import { groupJson, readGroupJsonBody } from "@/lib/groups/http";

/** POST /api/groups — create a group. Body: { alias, tags, entities, secret } */
export async function POST(request: Request) {
  const body = await readGroupJsonBody(request);
  if (!body.ok) return groupJson({ status: body.status });
  return groupJson(await handleCreateGroup(body.value));
}
