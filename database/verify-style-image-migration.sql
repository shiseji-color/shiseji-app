-- Read-only post-migration checks. Expected result: every boolean is true.
select
  to_regclass('public.style_image_jobs') is not null as jobs_table_exists,
  to_regprocedure('public.claim_style_image_job(text,uuid,text,uuid,boolean)') is not null
    as claim_rpc_exists,
  to_regprocedure('public.begin_style_image_provider_submission(text,uuid,text,uuid)') is not null
    as submission_rpc_exists,
  to_regprocedure('public.save_style_image_provider_task(text,uuid,text,uuid,text)') is not null
    as task_rpc_exists,
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
  ) as private_bucket_valid;

select
  count(*) filter (where status = 'completed' and result_path is null) = 0
    as completed_jobs_have_paths,
  count(*) filter (where status = 'failed' and failure_code is null) = 0
    as failed_jobs_have_codes,
  count(*) filter (where status in ('claimed', 'processing') and failure_code is not null) = 0
    as active_jobs_have_no_failure
from public.style_image_jobs;
