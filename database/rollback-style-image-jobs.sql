-- Guarded rollback for database/migrate-style-image-jobs.sql.
-- This intentionally refuses to run once the new protocol has stored jobs or files.
begin;

do $$
begin
  if to_regclass('public.style_image_jobs') is null then
    raise exception 'style_image_jobs does not exist';
  end if;

  if exists (select 1 from public.style_image_jobs) then
    raise exception 'rollback refused: style_image_jobs contains data';
  end if;

  if exists (
    select 1 from storage.objects where bucket_id = 'style-images'
  ) then
    raise exception 'rollback refused: style-images contains objects';
  end if;
end;
$$;

drop function if exists public.claim_style_image_job(text, uuid, text, uuid, boolean);
drop function if exists public.begin_style_image_provider_submission(text, uuid, text, uuid);
drop function if exists public.save_style_image_provider_task(text, uuid, text, uuid, text);
drop function if exists public.complete_style_image_job(text, uuid, text, uuid, text);
drop function if exists public.fail_style_image_job(text, uuid, text, uuid, text);

delete from storage.buckets where id = 'style-images';

drop index if exists public.style_image_jobs_updated_at_idx;

alter table public.style_image_jobs
  drop constraint if exists style_image_jobs_kind_check,
  drop constraint if exists style_image_jobs_code_hash_check,
  drop constraint if exists style_image_jobs_status_check,
  drop constraint if exists style_image_jobs_stage_check,
  drop constraint if exists style_image_jobs_result_state_valid,
  drop constraint if exists style_image_jobs_result_path_valid,
  drop constraint if exists style_image_jobs_provider_task_valid,
  drop constraint if exists style_image_jobs_failure_state_valid,
  alter column status drop default,
  drop column if exists stage,
  drop column if exists provider_task_id,
  drop column if exists result_path,
  drop column if exists failure_code,
  add constraint style_image_jobs_kind_check
    check (kind in ('beauty', 'outfit')),
  add constraint style_image_jobs_code_hash_check
    check (code_hash ~ '^[0-9a-f]{64}$'),
  add constraint style_image_jobs_status_check
    check (status in ('processing', 'completed', 'failed')),
  add constraint style_image_jobs_result_state_valid check (
    (status = 'completed') = (result_url is not null)
  ),
  add constraint style_image_jobs_result_url_valid check (
    result_url is null or result_url ~ '^https://'
  );

create function public.claim_style_image_job(
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

create function public.complete_style_image_job(
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

create function public.fail_style_image_job(
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
