begin;

create table if not exists public.style_image_jobs (
  request_id uuid not null,
  kind text not null,
  code_hash text not null,
  status text not null default 'claimed',
  stage text not null default 'claimed',
  owner_id uuid not null,
  provider_task_id text,
  result_path text,
  result_url text,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (request_id, kind)
);

alter table public.style_image_jobs
  add column if not exists stage text,
  add column if not exists provider_task_id text,
  add column if not exists result_path text,
  add column if not exists failure_code text;

alter table public.style_image_jobs
  alter column status set default 'claimed',
  alter column stage set default 'claimed';

alter table public.style_image_jobs
  drop constraint if exists style_image_jobs_kind_check,
  drop constraint if exists style_image_jobs_code_hash_check,
  drop constraint if exists style_image_jobs_status_check,
  drop constraint if exists style_image_jobs_stage_check,
  drop constraint if exists style_image_jobs_result_state_valid,
  drop constraint if exists style_image_jobs_result_url_valid,
  drop constraint if exists style_image_jobs_result_path_valid,
  drop constraint if exists style_image_jobs_provider_task_valid,
  drop constraint if exists style_image_jobs_failure_state_valid;

-- Jobs created by the former one-shot protocol cannot be resumed safely.
update public.style_image_jobs
set status = 'failed',
    stage = 'failed',
    provider_task_id = null,
    result_path = null,
    result_url = null,
    failure_code = 'style_image_legacy_job_failed',
    updated_at = now()
where status = 'processing'
   or (status = 'completed' and result_path is null);

update public.style_image_jobs
set stage = case status
  when 'completed' then 'completed'
  when 'failed' then 'failed'
  else 'claimed'
end
where stage is null;

update public.style_image_jobs
set failure_code = 'style_image_legacy_job_failed'
where status = 'failed' and failure_code is null;

alter table public.style_image_jobs
  alter column stage set not null,
  add constraint style_image_jobs_kind_check
    check (kind in ('beauty', 'outfit')),
  add constraint style_image_jobs_code_hash_check
    check (code_hash ~ '^[0-9a-f]{64}$'),
  add constraint style_image_jobs_status_check
    check (status in ('claimed', 'processing', 'completed', 'failed')),
  add constraint style_image_jobs_stage_check
    check (stage in ('claimed', 'submitting', 'provider_submitted', 'completed', 'failed')),
  add constraint style_image_jobs_result_state_valid check (
    (status = 'completed') = (result_path is not null)
  ),
  add constraint style_image_jobs_result_path_valid check (
    result_path is null or result_path ~ '^[0-9a-f]{64}/[0-9a-f-]{36}/(beauty|outfit)\.(png|jpe?g|webp)$'
  ),
  add constraint style_image_jobs_provider_task_valid check (
    provider_task_id is null or provider_task_id ~ '^[A-Za-z0-9._:-]{1,200}$'
  ),
  add constraint style_image_jobs_failure_state_valid check (
    (status = 'failed') = (failure_code is not null)
  );

create index if not exists style_image_jobs_updated_at_idx
on public.style_image_jobs (updated_at);

alter table public.style_image_jobs enable row level security;
alter table public.style_image_jobs force row level security;

revoke all on table public.style_image_jobs
from public, anon, authenticated, service_role;

grant select, insert, update
on table public.style_image_jobs
to service_role;

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

drop function if exists public.claim_style_image_job(text, uuid, text, uuid);
drop function if exists public.claim_style_image_job(text, uuid, text, uuid, boolean);
drop function if exists public.save_style_image_provider_task(text, uuid, text, uuid, text);
drop function if exists public.begin_style_image_provider_submission(text, uuid, text, uuid);
drop function if exists public.complete_style_image_job(uuid, text, uuid, text);
drop function if exists public.complete_style_image_job(text, uuid, text, uuid, text);
drop function if exists public.fail_style_image_job(uuid, text, uuid);
drop function if exists public.fail_style_image_job(text, uuid, text, uuid, text);

create function public.claim_style_image_job(
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
    set status = 'claimed',
        stage = 'claimed',
        provider_task_id = null,
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

create function public.begin_style_image_provider_submission(
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

create function public.save_style_image_provider_task(
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

create function public.complete_style_image_job(
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

create function public.fail_style_image_job(
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
