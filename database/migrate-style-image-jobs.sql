begin;

create table if not exists public.style_image_jobs (
  request_id uuid not null,
  kind text not null check (kind in ('beauty', 'outfit')),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('processing', 'completed', 'failed')),
  owner_id uuid not null,
  result_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (request_id, kind),
  constraint style_image_jobs_result_state_valid check (
    (status = 'completed') = (result_url is not null)
  ),
  constraint style_image_jobs_result_url_valid check (
    result_url is null or result_url ~ '^https://'
  )
);

alter table public.style_image_jobs enable row level security;
alter table public.style_image_jobs force row level security;

revoke all on table public.style_image_jobs
from public, anon, authenticated, service_role;

grant select, insert, update
on table public.style_image_jobs
to service_role;

create or replace function public.claim_style_image_job(
  p_code_hash text,
  p_request_id uuid,
  p_kind text,
  p_owner_id uuid
)
returns table (job_status text, result_url text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.style_image_jobs%rowtype;
begin
  insert into public.style_image_jobs (
    request_id, kind, code_hash, status, owner_id
  ) values (
    p_request_id, p_kind, lower(p_code_hash), 'processing', p_owner_id
  )
  on conflict (request_id, kind) do nothing;

  select * into v_job
  from public.style_image_jobs
  where request_id = p_request_id and kind = p_kind
  for update;

  if v_job.code_hash <> lower(p_code_hash) then
    raise exception 'Style image job authorization mismatch';
  end if;

  if v_job.owner_id = p_owner_id and v_job.status = 'processing' then
    return query select 'claimed'::text, null::text;
  elsif v_job.status = 'failed' then
    update public.style_image_jobs
    set status = 'processing', owner_id = p_owner_id,
        result_url = null, updated_at = now()
    where request_id = p_request_id and kind = p_kind;
    return query select 'claimed'::text, null::text;
  end if;

  return query select v_job.status, v_job.result_url;
end;
$$;

create or replace function public.complete_style_image_job(
  p_request_id uuid,
  p_kind text,
  p_owner_id uuid,
  p_result_url text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.style_image_jobs
  set status = 'completed', result_url = p_result_url, updated_at = now()
  where request_id = p_request_id and kind = p_kind
    and owner_id = p_owner_id and status = 'processing'
  returning true;
$$;

create or replace function public.fail_style_image_job(
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
  set status = 'failed', updated_at = now()
  where request_id = p_request_id and kind = p_kind
    and owner_id = p_owner_id and status = 'processing'
  returning true;
$$;

revoke execute on function public.claim_style_image_job(text, uuid, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.complete_style_image_job(uuid, text, uuid, text)
from public, anon, authenticated, service_role;
revoke execute on function public.fail_style_image_job(uuid, text, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.claim_style_image_job(text, uuid, text, uuid)
to service_role;
grant execute on function public.complete_style_image_job(uuid, text, uuid, text)
to service_role;
grant execute on function public.fail_style_image_job(uuid, text, uuid)
to service_role;

commit;
