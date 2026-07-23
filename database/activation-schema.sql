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

alter table public.activation_codes enable row level security;
alter table public.activation_codes force row level security;

revoke all on table public.activation_codes
from public, anon, authenticated;

grant select, insert, update
on table public.activation_codes
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

create or replace function public.consume_activation_use(
  p_code_hash text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining integer;
begin
  update public.activation_codes
  set
    remaining_uses = remaining_uses - 1,
    updated_at = now(),
    last_used_at = now()
  where code_hash = lower(p_code_hash)
    and enabled = true
    and remaining_uses > 0
  returning remaining_uses into v_remaining;

  return v_remaining;
end;
$$;

create or replace function public.refund_activation_use(
  p_code_hash text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining integer;
begin
  update public.activation_codes
  set
    remaining_uses = least(remaining_uses + 1, total_uses),
    updated_at = now()
  where code_hash = lower(p_code_hash)
    and enabled = true
    and remaining_uses < total_uses
  returning remaining_uses into v_remaining;

  return v_remaining;
end;
$$;

revoke execute on function public.activation_status(text)
from public, anon, authenticated;

revoke execute on function public.consume_activation_use(text)
from public, anon, authenticated;

revoke execute on function public.refund_activation_use(text)
from public, anon, authenticated;

grant execute on function public.activation_status(text)
to service_role;

grant execute on function public.consume_activation_use(text)
to service_role;

grant execute on function public.refund_activation_use(text)
to service_role;

commit;
