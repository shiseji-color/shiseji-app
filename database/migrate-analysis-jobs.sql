begin;

create table if not exists public.analysis_jobs (
  task_id uuid primary key,
  request_id uuid not null unique,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  owner_id uuid not null,
  photo_path text not null check (photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  status text not null check (status in ('queued', 'processing', 'completed', 'failed')),
  result jsonb,
  visual_token text,
  remaining_uses integer,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '20 minutes',
  photo_cleanup_claimed_at timestamptz,
  photo_deleted_at timestamptz,
  constraint analysis_jobs_result_state check ((status = 'completed') = (result is not null))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('analysis-temp','analysis-temp',false,3000000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=3000000,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

alter table public.analysis_jobs enable row level security;
alter table public.analysis_jobs force row level security;
revoke all on table public.analysis_jobs from public, anon, authenticated, service_role;
grant select, insert, update on table public.analysis_jobs to service_role;

create or replace function public.create_analysis_job(p_code_hash text, p_request_id uuid, p_task_id uuid, p_owner_id uuid, p_photo_path text)
returns table (task_id uuid, owner_id uuid, job_status text, created boolean, photo_path text)
language plpgsql security definer set search_path = '' as $$
declare v_job public.analysis_jobs%rowtype; v_row_count integer := 0;
begin
  select * into v_job from public.analysis_jobs j where j.request_id=p_request_id;
  if found then
    if v_job.code_hash <> lower(p_code_hash) then raise exception 'Analysis job authorization mismatch'; end if;
    return query select v_job.task_id,v_job.owner_id,v_job.status,false,v_job.photo_path; return;
  end if;
  if not exists (select 1 from public.activation_codes a where a.code_hash=lower(p_code_hash) and a.enabled and a.remaining_uses>0) then return; end if;
  insert into public.analysis_jobs(task_id,request_id,code_hash,owner_id,photo_path,status)
  values(p_task_id,p_request_id,lower(p_code_hash),p_owner_id,p_photo_path,'queued') on conflict(request_id) do nothing;
  get diagnostics v_row_count = row_count;
  select * into v_job from public.analysis_jobs j where j.request_id=p_request_id;
  return query select v_job.task_id,v_job.owner_id,v_job.status,(v_row_count = 1),v_job.photo_path;
end $$;

create or replace function public.claim_analysis_job(p_code_hash text,p_request_id uuid,p_task_id uuid,p_owner_id uuid)
returns table(job_status text) language plpgsql security definer set search_path='' as $$
begin
  update public.analysis_jobs set status='processing',updated_at=now()
  where task_id=p_task_id and request_id=p_request_id and code_hash=lower(p_code_hash) and owner_id=p_owner_id and status='queued';
  if found then return query select 'claimed'::text; else
    return query select j.status from public.analysis_jobs j
    where j.task_id=p_task_id and j.request_id=p_request_id and j.code_hash=lower(p_code_hash) and j.owner_id=p_owner_id;
  end if;
end $$;

create or replace function public.complete_analysis_job(p_code_hash text,p_request_id uuid,p_task_id uuid,p_owner_id uuid,p_result jsonb,p_visual_token text,p_charge_use boolean)
returns table(completed boolean,remaining_uses integer) language plpgsql security definer set search_path='' as $$
declare v_remaining integer; v_job public.analysis_jobs%rowtype;
begin
  select * into v_job from public.analysis_jobs j
  where j.task_id=p_task_id and j.request_id=p_request_id and j.code_hash=lower(p_code_hash) and j.owner_id=p_owner_id
  for update;
  if not found or v_job.status <> 'processing' then
    return query select false,null::integer; return;
  end if;
  select a.remaining_uses into v_remaining from public.activation_codes a where a.code_hash=lower(p_code_hash) for update;
  if p_charge_use then
    update public.activation_codes a set remaining_uses=a.remaining_uses-1,updated_at=now(),last_used_at=now()
    where a.code_hash=lower(p_code_hash) and a.enabled and a.remaining_uses>0 returning a.remaining_uses into v_remaining;
    if not found then
      update public.analysis_jobs set status='failed',failure_code='no_remaining_uses',updated_at=now() where task_id=p_task_id;
      return query select false,coalesce(v_remaining,0); return;
    end if;
    insert into public.activation_usage_events(request_id,code_hash,status,remaining_uses)
    values(p_request_id,lower(p_code_hash),'reserved',v_remaining) on conflict(request_id) do nothing;
  end if;
  update public.analysis_jobs set status='completed',result=p_result,visual_token=p_visual_token,
    remaining_uses=v_remaining,updated_at=now()
  where task_id=p_task_id;
  return query select true,v_remaining;
end $$;

create or replace function public.fail_analysis_job(p_code_hash text,p_request_id uuid,p_task_id uuid,p_owner_id uuid,p_reason text)
returns boolean language sql security definer set search_path='' as $$
  update public.analysis_jobs set status='failed',failure_code=left(p_reason,64),updated_at=now()
  where task_id=p_task_id and request_id=p_request_id and code_hash=lower(p_code_hash) and owner_id=p_owner_id and status in ('queued','processing') returning true;
$$;

create or replace function public.get_analysis_job(p_code_hash text,p_request_id uuid,p_task_id uuid,p_owner_id uuid)
returns table(job_status text,result jsonb,visual_token text,remaining_uses integer,failure_code text,photo_path text)
language plpgsql security definer set search_path='' as $$
begin
  update public.analysis_jobs set status='failed',failure_code='worker_timeout',updated_at=now()
  where task_id=p_task_id and status in ('queued','processing') and updated_at < now()-interval '16 minutes';
  return query select j.status,j.result,j.visual_token,j.remaining_uses,j.failure_code,j.photo_path from public.analysis_jobs j
  where j.task_id=p_task_id and j.request_id=p_request_id and j.code_hash=lower(p_code_hash) and j.owner_id=p_owner_id;
end $$;

create or replace function public.claim_expired_analysis_photos()
returns table(photo_path text) language plpgsql security definer set search_path='' as $$
begin
  update public.analysis_jobs j set status='failed',failure_code=coalesce(j.failure_code,'worker_timeout'),updated_at=now()
  where j.expires_at < now() and j.status in ('queued','processing');
  return query
  with expired as (
    select j.task_id from public.analysis_jobs j
    where j.expires_at < now() and j.photo_deleted_at is null
      and (j.photo_cleanup_claimed_at is null or j.photo_cleanup_claimed_at < now()-interval '5 minutes')
    order by j.expires_at limit 25 for update skip locked
  )
  update public.analysis_jobs j set photo_cleanup_claimed_at=now()
  from expired e where j.task_id=e.task_id returning j.photo_path;
end;
$$;

create or replace function public.mark_analysis_photo_deleted(p_photo_path text)
returns boolean language sql security definer set search_path='' as $$
  update public.analysis_jobs set photo_deleted_at=now() where photo_path=p_photo_path returning true;
$$;

revoke execute on function public.create_analysis_job(text,uuid,uuid,uuid,text), public.claim_analysis_job(text,uuid,uuid,uuid), public.complete_analysis_job(text,uuid,uuid,uuid,jsonb,text,boolean), public.fail_analysis_job(text,uuid,uuid,uuid,text), public.get_analysis_job(text,uuid,uuid,uuid), public.claim_expired_analysis_photos(), public.mark_analysis_photo_deleted(text) from public,anon,authenticated;
grant execute on function public.create_analysis_job(text,uuid,uuid,uuid,text), public.claim_analysis_job(text,uuid,uuid,uuid), public.complete_analysis_job(text,uuid,uuid,uuid,jsonb,text,boolean), public.fail_analysis_job(text,uuid,uuid,uuid,text), public.get_analysis_job(text,uuid,uuid,uuid), public.claim_expired_analysis_photos(), public.mark_analysis_photo_deleted(text) to service_role;

commit;
