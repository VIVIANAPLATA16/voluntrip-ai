export const GROUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const GROUP_CODE_LENGTH = 8;
export const GROUP_MAX_MEMBERS = 6;
export const GROUP_MAX_TAGS = 8;
export const GROUP_MAX_ENTITIES = 5;
export const GROUP_ALIAS_MAX = 24;
export const GROUP_TAG_MAX = 120;
export const GROUP_ENTITY_NAME_MAX = 80;
export const GROUP_ENTITY_TYPE_MAX = 24;
export const GROUP_META_KEY = "groups";
export const MAX_GROUP_BODY_BYTES = 8192;

export const GROUP_STATUSES = [
  "ok",
  "unavailable",
  "invalid_code",
  "invalid_alias",
  "invalid_tags",
  "invalid_entities",
  "invalid_secret",
  "extra_fields",
  "too_large",
  "alias_taken",
  "group_full",
  "not_found",
  "unauthorized",
  "no_consent",
  "rate_limited",
  "code_taken",
] as const;

export type GroupStatus = (typeof GROUP_STATUSES)[number];
export type GroupErrStatus = Exclude<GroupStatus, "ok">;

export type GroupEntity = {
  id: string;
  name: string;
  type: string;
};

export type SyncedGroupMember = {
  id: string;
  alias: string;
  tags: string[];
  entities: GroupEntity[];
  source: "synced";
};

export type GroupPublic = {
  id: string;
  code: string;
  name: string;
  expiresAt: string;
  members: SyncedGroupMember[];
};

export type GroupSession = {
  groupId: string;
  memberId: string;
  secret: string;
  code: string;
};

export type GroupOk = {
  status: "ok";
  group: GroupPublic;
  memberId?: string;
};

export type GroupErr = {
  status: GroupErrStatus;
};

export type GroupResult = GroupOk | GroupErr;

export type GroupLeaveResult = { status: "ok" } | GroupErr;

export type GroupOverlapTag = {
  tag: string;
  memberCount: number;
};

export type GroupOverlapEntity = {
  id: string;
  memberCount: number;
};

export type GroupOverlap = {
  overlap: "none" | "shared";
  tags: GroupOverlapTag[];
  entities: GroupOverlapEntity[];
};

export type GroupFunctionName =
  | "create_group"
  | "join_group"
  | "get_group"
  | "update_member"
  | "leave_group";
