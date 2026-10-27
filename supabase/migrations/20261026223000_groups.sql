-- Shared groups (no accounts). Access is SECURITY DEFINER RPCs only.
-- Tables are locked: RLS on, no policies, no grants to anon/authenticated.

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  alias text not null,
  tags jsonb not null default '[]'::jsonb,
  entities jsonb not null default '[]'::jsonb,
  secret_hash text not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists group_members_group_alias_idx
  on public.group_members (group_id, lower(alias));

create index if not exists group_members_group_id_idx
  on public.group_members (group_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

revoke all on table public.groups from public, anon, authenticated;
revoke all on table public.group_members from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Validation helpers (not granted to anon)
-- ---------------------------------------------------------------------------

create or replace function public._group_validate_code(p_code text)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_code is null or p_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' then
    raise exception 'invalid_code';
  end if;
end;
$$;

create or replace function public._group_validate_alias(p_alias text)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_alias is null
     or char_length(p_alias) < 1
     or char_length(p_alias) > 24
     or p_alias ~ '[<>]' then
    raise exception 'invalid_alias';
  end if;
end;
$$;

create or replace function public._group_validate_hash(p_secret_hash text)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_secret_hash is null or p_secret_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'unauthorized';
  end if;
end;
$$;

create or replace function public._group_validate_tags(p_tags jsonb)
returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  elem jsonb;
  tag text;
begin
  if p_tags is null or jsonb_typeof(p_tags) is distinct from 'array' then
    raise exception 'invalid_tags';
  end if;
  if jsonb_array_length(p_tags) > 8 then
    raise exception 'invalid_tags';
  end if;
  for elem in select value from jsonb_array_elements(p_tags)
  loop
    if jsonb_typeof(elem) is distinct from 'string' then
      raise exception 'invalid_tags';
    end if;
    tag := elem #>> '{}';
    if tag is null
       or char_length(tag) < 9
       or char_length(tag) > 120
       or tag not like 'urn:tag:%' then
      raise exception 'invalid_tags';
    end if;
  end loop;
end;
$$;

create or replace function public._group_validate_entities(p_entities jsonb)
returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  elem jsonb;
  keys text[];
  ent_id text;
  ent_name text;
  ent_type text;
begin
  if p_entities is null or jsonb_typeof(p_entities) is distinct from 'array' then
    raise exception 'invalid_entities';
  end if;
  if jsonb_array_length(p_entities) > 5 then
    raise exception 'invalid_entities';
  end if;
  for elem in select value from jsonb_array_elements(p_entities)
  loop
    if jsonb_typeof(elem) is distinct from 'object' then
      raise exception 'invalid_entities';
    end if;
    select coalesce(array_agg(k order by k), array[]::text[])
      into keys
      from jsonb_object_keys(elem) as k;
    if keys is distinct from array['id', 'name', 'type']::text[] then
      raise exception 'invalid_entities';
    end if;
    ent_id := elem ->> 'id';
    ent_name := elem ->> 'name';
    ent_type := elem ->> 'type';
    if ent_id is null
       or ent_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'invalid_entities';
    end if;
    if ent_name is null
       or char_length(ent_name) < 1
       or char_length(ent_name) > 80
       or ent_name ~ '[<>]' then
      raise exception 'invalid_entities';
    end if;
    if ent_type is null
       or char_length(ent_type) < 1
       or char_length(ent_type) > 24 then
      raise exception 'invalid_entities';
    end if;
  end loop;
end;
$$;

create or replace function public._group_validate_payload(
  p_alias text,
  p_tags jsonb,
  p_entities jsonb,
  p_secret_hash text
)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  perform public._group_validate_alias(p_alias);
  perform public._group_validate_tags(p_tags);
  perform public._group_validate_entities(p_entities);
  perform public._group_validate_hash(p_secret_hash);
end;
$$;

create or replace function public._group_member_public(m public.group_members)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', m.id,
    'alias', m.alias,
    'tags', m.tags,
    'entities', m.entities,
    'source', 'synced',
    'updatedAt', m.updated_at
  );
$$;

create or replace function public._group_payload(g public.groups)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', g.id,
    'code', g.code,
    'name', g.name,
    'expiresAt', g.expires_at,
    'members', coalesce((
      select jsonb_agg(public._group_member_public(m) order by lower(m.alias))
      from public.group_members m
      where m.group_id = g.id
    ), '[]'::jsonb)
  );
$$;

create or replace function public._group_live_by_code(p_code text)
returns public.groups
language plpgsql
stable
set search_path = public
as $$
declare
  g public.groups;
begin
  perform public._group_validate_code(p_code);
  select * into g
  from public.groups
  where code = p_code
    and expires_at > now();
  if not found then
    raise exception 'not_found';
  end if;
  return g;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_group(
  p_code text,
  p_alias text,
  p_tags jsonb,
  p_entities jsonb,
  p_secret_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
  m public.group_members;
begin
  perform public._group_validate_code(p_code);
  perform public._group_validate_payload(p_alias, p_tags, p_entities, p_secret_hash);

  begin
    insert into public.groups (code, name)
    values (p_code, p_alias)
    returning * into g;
  exception
    when unique_violation then
      raise exception 'code_taken';
  end;

  begin
    insert into public.group_members (group_id, alias, tags, entities, secret_hash)
    values (g.id, p_alias, p_tags, p_entities, p_secret_hash)
    returning * into m;
  exception
    when unique_violation then
      raise exception 'alias_taken';
  end;

  return jsonb_build_object(
    'group', public._group_payload(g),
    'memberId', m.id
  );
end;
$$;

create or replace function public.join_group(
  p_code text,
  p_alias text,
  p_tags jsonb,
  p_entities jsonb,
  p_secret_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
  m public.group_members;
  n integer;
begin
  perform public._group_validate_payload(p_alias, p_tags, p_entities, p_secret_hash);
  g := public._group_live_by_code(p_code);

  perform pg_advisory_xact_lock(hashtext(g.id::text));

  select count(*) into n
  from public.group_members
  where group_id = g.id;
  if n >= 6 then
    raise exception 'group_full';
  end if;

  begin
    insert into public.group_members (group_id, alias, tags, entities, secret_hash)
    values (g.id, p_alias, p_tags, p_entities, p_secret_hash)
    returning * into m;
  exception
    when unique_violation then
      raise exception 'alias_taken';
  end;

  select * into g from public.groups where id = g.id;

  return jsonb_build_object(
    'group', public._group_payload(g),
    'memberId', m.id
  );
end;
$$;

create or replace function public.get_group(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
begin
  g := public._group_live_by_code(p_code);
  return jsonb_build_object('group', public._group_payload(g));
end;
$$;

create or replace function public.update_member(
  p_group_id uuid,
  p_member_id uuid,
  p_secret_hash text,
  p_alias text,
  p_tags jsonb,
  p_entities jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
  m public.group_members;
begin
  perform public._group_validate_payload(p_alias, p_tags, p_entities, p_secret_hash);

  select * into g
  from public.groups
  where id = p_group_id
    and expires_at > now();
  if not found then
    raise exception 'not_found';
  end if;

  select * into m
  from public.group_members
  where id = p_member_id
    and group_id = p_group_id;
  if not found then
    raise exception 'unauthorized';
  end if;
  if m.secret_hash is distinct from p_secret_hash then
    raise exception 'unauthorized';
  end if;

  begin
    update public.group_members
    set alias = p_alias,
        tags = p_tags,
        entities = p_entities,
        updated_at = now()
    where id = m.id
    returning * into m;
  exception
    when unique_violation then
      raise exception 'alias_taken';
  end;

  select * into g from public.groups where id = g.id;

  return jsonb_build_object(
    'group', public._group_payload(g),
    'memberId', m.id
  );
end;
$$;

create or replace function public.leave_group(
  p_group_id uuid,
  p_member_id uuid,
  p_secret_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
  m public.group_members;
begin
  perform public._group_validate_hash(p_secret_hash);

  select * into g
  from public.groups
  where id = p_group_id
    and expires_at > now();
  if not found then
    raise exception 'not_found';
  end if;

  select * into m
  from public.group_members
  where id = p_member_id
    and group_id = p_group_id;
  if not found then
    raise exception 'unauthorized';
  end if;
  if m.secret_hash is distinct from p_secret_hash then
    raise exception 'unauthorized';
  end if;

  delete from public.group_members where id = m.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public._group_validate_code(text) from public, anon, authenticated;
revoke all on function public._group_validate_alias(text) from public, anon, authenticated;
revoke all on function public._group_validate_hash(text) from public, anon, authenticated;
revoke all on function public._group_validate_tags(jsonb) from public, anon, authenticated;
revoke all on function public._group_validate_entities(jsonb) from public, anon, authenticated;
revoke all on function public._group_validate_payload(text, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public._group_member_public(public.group_members) from public, anon, authenticated;
revoke all on function public._group_payload(public.groups) from public, anon, authenticated;
revoke all on function public._group_live_by_code(text) from public, anon, authenticated;

revoke all on function public.create_group(text, text, jsonb, jsonb, text) from public;
revoke all on function public.join_group(text, text, jsonb, jsonb, text) from public;
revoke all on function public.get_group(text) from public;
revoke all on function public.update_member(uuid, uuid, text, text, jsonb, jsonb) from public;
revoke all on function public.leave_group(uuid, uuid, text) from public;

grant execute on function public.create_group(text, text, jsonb, jsonb, text) to anon;
grant execute on function public.join_group(text, text, jsonb, jsonb, text) to anon;
grant execute on function public.get_group(text) to anon;
grant execute on function public.update_member(uuid, uuid, text, text, jsonb, jsonb) to anon;
grant execute on function public.leave_group(uuid, uuid, text) to anon;
