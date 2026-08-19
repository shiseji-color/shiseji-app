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

create table if not exists public.style_image_jobs (
  request_id uuid not null,
  kind text not null check (kind in ('beauty', 'outfit')),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'claimed'
    check (status in ('claimed', 'processing', 'completed', 'failed')),
  stage text not null default 'claimed'
    check (stage in ('claimed', 'submitting', 'provider_submitted', 'completed', 'failed')),
  owner_id uuid not null,
  provider_task_id text
    check (provider_task_id is null or provider_task_id ~ '^[A-Za-z0-9._:-]{1,200}$'),
  result_path text,
  result_url text,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (request_id, kind),
  constraint style_image_jobs_result_state_valid check (
    (status = 'completed') = (result_path is not null)
  ),
  constraint style_image_jobs_result_path_valid check (
    result_path is null or result_path ~ '^[0-9a-f]{64}/[0-9a-f-]{36}/(beauty|outfit)\.(png|jpe?g|webp)$'
  ),
  constraint style_image_jobs_failure_state_valid check (
    (status = 'failed') = (failure_code is not null)
  )
);

create index if not exists style_image_jobs_updated_at_idx
  on public.style_image_jobs (updated_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'style-images',
  'style-images',
  false,
  5767168,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.activation_codes enable row level security;
alter table public.activation_codes force row level security;
alter table public.activation_usage_events enable row level security;
alter table public.activation_usage_events force row level security;
alter table public.style_image_jobs enable row level security;
alter table public.style_image_jobs force row level security;

revoke all on table public.activation_codes
from public, anon, authenticated;

revoke all on table public.activation_usage_events
from public, anon, authenticated;

revoke all on table public.style_image_jobs
from public, anon, authenticated, service_role;

grant select, insert, update
on table public.activation_codes
to service_role;

grant select, insert, update
on table public.activation_usage_events
to service_role;

grant select, insert, update
on table public.style_image_jobs
to service_role;

drop function if exists public.claim_style_image_job(text, uuid, text, uuid);
drop function if exists public.claim_style_image_job(text, uuid, text, uuid, boolean);
drop function if exists public.save_style_image_provider_task(text, uuid, text, uuid, text);
drop function if exists public.begin_style_image_provider_submission(text, uuid, text, uuid);
drop function if exists public.complete_style_image_job(uuid, text, uuid, text);
drop function if exists public.complete_style_image_job(text, uuid, text, uuid, text);
drop function if exists public.fail_style_image_job(uuid, text, uuid);
drop function if exists public.fail_style_image_job(text, uuid, text, uuid, text);

create or replace function public.claim_style_image_job(
  p_code_hash text,
  p_request_id uuid,
  p_kind text,
  p_owner_id uuid,
  p_retry boolean default false
)
returns table (
  job_status text,
  job_stage text,
  provider_task_id text,
  result_path text,
  failure_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.style_image_jobs%rowtype;
begin
  if p_kind not in ('beauty', 'outfit')
     or lower(p_code_hash) !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid style image job input';
  end if;

  insert into public.style_image_jobs (
    request_id, kind, code_hash, status, stage, owner_id
  ) values (
    p_request_id, p_kind, lower(p_code_hash), 'claimed', 'claimed', p_owner_id
  )
  on conflict (request_id, kind) do nothing;

  select * into v_job
  from public.style_image_jobs
  where request_id = p_request_id and kind = p_kind
  for update;

  if v_job.code_hash <> lower(p_code_hash) or v_job.owner_id <> p_owner_id then
    raise exception 'Style image job authorization mismatch';
  end if;

  if v_job.status in ('claimed', 'processing')
     and v_job.updated_at < now() - interval '15 minutes' then
    update public.style_image_jobs
    set status = 'failed',
        stage = 'failed',
        failure_code = 'style_image_job_timeout',
        updated_at = now()
    where request_id = p_request_id and kind = p_kind
    returning * into v_job;
  end if;

  if v_job.status = 'failed' and p_retry then
    update public.style_image_jobs
    set status = case
          when failure_code = 'style_image_job_timeout' and provider_task_id is not null
            then 'processing'
          else 'claimed'
        end,
        stage = case
          when failure_code = 'style_image_job_timeout' and provider_task_id is not null
            then 'provider_submitted'
          else 'claimed'
        end,
        provider_task_id = case
          when failure_code = 'style_image_job_timeout' then provider_task_id
          else null
        end,
        result_path = null,
        result_url = null,
        failure_code = null,
        updated_at = now()
    where request_id = p_request_id and kind = p_kind
    returning * into v_job;
  end if;

  return query select
    v_job.status,
    v_job.stage,
    v_job.provider_task_id,
    v_job.result_path,
    v_job.failure_code;
end;
$$;

create or replace function public.begin_style_image_provider_submission(
  p_code_hash text,
  p_request_id uuid,
  p_kind text,
  p_owner_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.style_image_jobs
  set stage = 'submitting', updated_at = now()
  where code_hash = lower(p_code_hash)
    and request_id = p_request_id
    and kind = p_kind
    and owner_id = p_owner_id
    and status = 'claimed'
    and stage = 'claimed'
  returning true;
$$;

create or replace function public.save_style_image_provider_task(
  p_code_hash text,
  p_request_id uuid,
  p_kind text,
  p_owner_id uuid,
  p_provider_task_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing text;
begin
  select provider_task_id into v_existing
  from public.style_image_jobs
  where code_hash = lower(p_code_hash)
    and request_id = p_request_id
    and kind = p_kind
    and owner_id = p_owner_id
  for update;

  if not found then
    return false;
  end if;

  if v_existing is not null and v_existing <> p_provider_task_id then
    return false;
  end if;

  update public.style_image_jobs
  set status = 'processing',
      stage = 'provider_submitted',
      provider_task_id = p_provider_task_id,
      updated_at = now()
  where code_hash = lower(p_code_hash)
    and request_id = p_request_id
    and kind = p_kind
    and owner_id = p_owner_id
    and status in ('claimed', 'processing')
    and stage in ('submitting', 'provider_submitted');

  return found;
end;
$$;

create or replace function public.complete_style_image_job(
  p_code_hash text,
  p_request_id uuid,
  p_kind text,
  p_owner_id uuid,
  p_result_path text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.style_image_jobs
  set status = 'completed',
      stage = 'completed',
      result_path = p_result_path,
      result_url = null,
      failure_code = null,
      updated_at = now()
  where code_hash = lower(p_code_hash)
    and request_id = p_request_id
    and kind = p_kind
    and owner_id = p_owner_id
    and status in ('claimed', 'processing')
  returning true;
$$;

create or replace function public.fail_style_image_job(
  p_code_hash text,
  p_request_id uuid,
  p_kind text,
  p_owner_id uuid,
  p_failure_code text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.style_image_jobs
  set status = 'failed',
      stage = 'failed',
      result_path = null,
      result_url = null,
      failure_code = case
        when p_failure_code ~ '^[a-z0-9_]{3,80}$' then p_failure_code
        else 'style_image_internal_failed'
      end,
      updated_at = now()
  where code_hash = lower(p_code_hash)
    and request_id = p_request_id
    and kind = p_kind
    and owner_id = p_owner_id
    and status in ('claimed', 'processing')
  returning true;
$$;

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

revoke execute on function public.claim_style_image_job(text, uuid, text, uuid, boolean)
from public, anon, authenticated, service_role;
revoke execute on function public.save_style_image_provider_task(text, uuid, text, uuid, text)
from public, anon, authenticated, service_role;
revoke execute on function public.begin_style_image_provider_submission(text, uuid, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.complete_style_image_job(text, uuid, text, uuid, text)
from public, anon, authenticated, service_role;
revoke execute on function public.fail_style_image_job(text, uuid, text, uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.claim_style_image_job(text, uuid, text, uuid, boolean)
to service_role;
grant execute on function public.save_style_image_provider_task(text, uuid, text, uuid, text)
to service_role;
grant execute on function public.begin_style_image_provider_submission(text, uuid, text, uuid)
to service_role;
grant execute on function public.complete_style_image_job(text, uuid, text, uuid, text)
to service_role;
grant execute on function public.fail_style_image_job(text, uuid, text, uuid, text)
to service_role;

commit;
