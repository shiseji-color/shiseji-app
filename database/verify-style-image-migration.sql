-- Read-only post-migration checks. Expected result: every boolean is true,
-- every function row is SECURITY DEFINER with an empty search_path, and the
-- service role is the only application role with access.
select
  to_regclass('public.style_image_jobs') is not null as jobs_table_exists,
  to_regprocedure('public.claim_style_image_job(text,uuid,text,uuid,boolean)') is not null
    as claim_rpc_exists,
  to_regprocedure('public.begin_style_image_provider_submission(text,uuid,text,uuid)') is not null
    as submission_rpc_exists,
  to_regprocedure('public.save_style_image_provider_task(text,uuid,text,uuid,text)') is not null
    as task_rpc_exists,
  to_regprocedure('public.save_style_image_source(text,uuid,text,uuid,text)') is not null
    as source_rpc_exists,
  to_regprocedure('public.save_style_image_provider_result(text,uuid,text,uuid,text)') is not null
    as provider_result_rpc_exists,
  to_regprocedure('public.complete_style_image_job(text,uuid,text,uuid,text)') is not null
    as completion_rpc_exists,
  to_regprocedure('public.fail_style_image_job(text,uuid,text,uuid,text)') is not null
    as failure_rpc_exists;

select
  exists (
    select 1 from storage.buckets
    where id = 'style-images'
      and public = false
      and file_size_limit = 5767168
      and allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp']
      and allowed_mime_types <@ array['image/png', 'image/jpeg', 'image/webp']
  ) as private_bucket_valid;

select
  relrowsecurity as rls_enabled,
  relforcerowsecurity as rls_forced
from pg_class
where oid = 'public.style_image_jobs'::regclass;

select
  not has_table_privilege('anon', 'public.style_image_jobs', 'select')
    as anon_table_blocked,
  not has_table_privilege('authenticated', 'public.style_image_jobs', 'select')
    as authenticated_table_blocked,
  has_table_privilege('service_role', 'public.style_image_jobs', 'select')
    as service_can_select,
  has_table_privilege('service_role', 'public.style_image_jobs', 'insert')
    as service_can_insert,
  has_table_privilege('service_role', 'public.style_image_jobs', 'update')
    as service_can_update,
  not has_table_privilege('service_role', 'public.style_image_jobs', 'delete')
    as service_cannot_delete;

select
  p.proname,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
    as search_path_pinned,
  not has_function_privilege('anon', p.oid, 'execute') as anon_execute_blocked,
  not has_function_privilege('authenticated', p.oid, 'execute')
    as authenticated_execute_blocked,
  has_function_privilege('service_role', p.oid, 'execute') as service_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'claim_style_image_job',
    'begin_style_image_provider_submission',
    'save_style_image_provider_task',
    'save_style_image_source',
    'save_style_image_provider_result',
    'complete_style_image_job',
    'fail_style_image_job'
  )
order by p.proname;

select
  count(*) filter (where conname in (
    'style_image_jobs_kind_check',
    'style_image_jobs_code_hash_check',
    'style_image_jobs_status_check',
    'style_image_jobs_stage_check',
    'style_image_jobs_result_state_valid',
    'style_image_jobs_result_path_valid',
    'style_image_jobs_provider_task_valid',
    'style_image_jobs_source_path_valid',
    'style_image_jobs_failure_state_valid'
  ) and convalidated) = 9 as all_job_constraints_valid
from pg_constraint
where conrelid = 'public.style_image_jobs'::regclass;

select
  count(*) filter (where status = 'completed' and result_path is null) = 0
    as completed_jobs_have_paths,
  count(*) filter (where status = 'failed' and failure_code is null) = 0
    as failed_jobs_have_codes,
  count(*) filter (where status in ('claimed', 'processing') and failure_code is not null) = 0
    as active_jobs_have_no_failure
from public.style_image_jobs;
