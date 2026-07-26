begin;

create table if not exists public.activation_codes (
  code_hash text primary key
    check (code_hash ~ '^[0-9a-f]{64}$'),
  remaining_uses integer not null default 6,
  total_uses integer not null default 6,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint activation_codes_total_positive
    check (total_uses > 0),
  constraint activation_codes_remaining_valid
    check (
      remaining_uses >= 0
      and remaining_uses <= total_uses
    )
);

create table if not exists public.activation_usage_events (
  request_id uuid primary key,
  code_hash text not null
    references public.activation_codes(code_hash)
    on delete restrict,
  status text not null
    check (status in ('reserved', 'refunded')),
  remaining_uses integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activation_usage_events_code_created_idx
  on public.activation_usage_events (code_hash, created_at desc);

alter table public.activation_codes enable row level security;
alter table public.activation_codes force row level security;
alter table public.activation_usage_events enable row level security;
alter table public.activation_usage_events force row level security;

revoke all on table public.activation_codes
from public, anon, authenticated;

revoke all on table public.activation_usage_events
from public, anon, authenticated;

grant select, insert, update
on table public.activation_codes
to service_role;

grant select, insert, update
on table public.activation_usage_events
to service_role;

create or replace function public.activation_status(
  p_code_hash text
)
returns table (
  is_valid boolean,
  remaining_uses integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    (a.enabled and a.remaining_uses > 0),
    a.remaining_uses
  from public.activation_codes as a
  where a.code_hash = lower(p_code_hash);

  if not found then
    return query
    select false, 0;
  end if;
end;
$$;

drop function if exists public.consume_activation_use(text);
drop function if exists public.refund_activation_use(text);

create or replace function public.consume_activation_use(
  p_code_hash text,
  p_request_id uuid
)
returns table (
  remaining_uses integer,
  already_processed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining integer;
begin
  select e.remaining_uses
  into v_remaining
  from public.activation_usage_events as e
  where e.request_id = p_request_id
    and e.code_hash = lower(p_code_hash);

  if found then
    return query select v_remaining, true;
    return;
  end if;

  update public.activation_codes as a
  set
    remaining_uses = a.remaining_uses - 1,
    updated_at = now(),
    last_used_at = now()
  where a.code_hash = lower(p_code_hash)
    and a.enabled = true
    and a.remaining_uses > 0
  returning a.remaining_uses into v_remaining;

  if v_remaining is null then
    return;
  end if;

  insert into public.activation_usage_events (
    request_id,
    code_hash,
    status,
    remaining_uses
  )
  values (
    p_request_id,
    lower(p_code_hash),
    'reserved',
    v_remaining
  );

  return query select v_remaining, false;
end;
$$;

create or replace function public.refund_activation_use(
  p_code_hash text,
  p_request_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining integer;
  v_claimed_request uuid;
begin
  update public.activation_usage_events
  set status = 'refunded', updated_at = now()
  where request_id = p_request_id
    and code_hash = lower(p_code_hash)
    and status = 'reserved'
  returning request_id into v_claimed_request;

  if v_claimed_request is null then
    return null;
  end if;

  update public.activation_codes as a
  set
    remaining_uses = least(a.remaining_uses + 1, a.total_uses),
    updated_at = now()
  where a.code_hash = lower(p_code_hash)
    and a.enabled = true
    and a.remaining_uses < a.total_uses
  returning a.remaining_uses into v_remaining;

  if v_remaining is null then
    raise exception 'Activation refund could not be applied';
  end if;

  return v_remaining;
end;
$$;

revoke execute on function public.activation_status(text)
from public, anon, authenticated;

revoke execute on function public.consume_activation_use(text, uuid)
from public, anon, authenticated;

revoke execute on function public.refund_activation_use(text, uuid)
from public, anon, authenticated;

grant execute on function public.activation_status(text)
to service_role;

grant execute on function public.consume_activation_use(text, uuid)
to service_role;

grant execute on function public.refund_activation_use(text, uuid)
to service_role;

commit;
