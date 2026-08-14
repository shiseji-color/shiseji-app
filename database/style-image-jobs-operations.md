# 造型图任务迁移操作说明

## 迁移前只读留档

执行迁移前先记录现有两张表的行数：

```sql
select count(*) as activation_code_count from public.activation_codes;
select count(*) as activation_usage_event_count from public.activation_usage_events;
```

## 迁移后只读验证

以下检查只读取系统目录或新表，不会调用三个任务函数，也不会生成测试数据。

```sql
-- 1. 新表存在，并且当前应为空。
select to_regclass('public.style_image_jobs') as table_name;
select count(*) as style_image_job_count from public.style_image_jobs;

-- 2. 主键、状态、类型、结果状态和 HTTPS 约束均存在。
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.style_image_jobs'::regclass
order by conname;

-- 3. RLS 已启用并强制执行。
select relrowsecurity, relforcerowsecurity
from pg_class
where oid = 'public.style_image_jobs'::regclass;

-- 4. 三个函数存在，均为 SECURITY DEFINER，且 search_path 为空。
select p.proname,
       p.prosecdef,
       p.proconfig,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'claim_style_image_job',
    'complete_style_image_job',
    'fail_style_image_job'
  )
order by p.proname;

-- 5. 公众和客户端角色不可访问；service_role 拥有所需最小权限。
select
  has_table_privilege('anon', 'public.style_image_jobs', 'select') as anon_select,
  has_table_privilege('authenticated', 'public.style_image_jobs', 'select') as authenticated_select,
  has_table_privilege('service_role', 'public.style_image_jobs', 'select') as service_select,
  has_table_privilege('service_role', 'public.style_image_jobs', 'insert') as service_insert,
  has_table_privilege('service_role', 'public.style_image_jobs', 'update') as service_update,
  has_table_privilege('service_role', 'public.style_image_jobs', 'delete') as service_delete;

-- 6. 三个函数仅允许 service_role 执行。
select p.proname,
       has_function_privilege(
         'anon', p.oid, 'execute'
       ) as anon_execute,
       has_function_privilege(
         'authenticated', p.oid, 'execute'
       ) as authenticated_execute,
       has_function_privilege(
         'service_role', p.oid, 'execute'
       ) as service_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'claim_style_image_job',
    'complete_style_image_job',
    'fail_style_image_job'
  )
order by p.proname;

-- 7. 原有数据数量与迁移前留档对比应完全一致。
select count(*) as activation_code_count from public.activation_codes;
select count(*) as activation_usage_event_count from public.activation_usage_events;
```

预期结果：新表存在且首次迁移后为空；六项约束存在；两项 RLS 值均为 `true`；三个函数的 `prosecdef` 为 `true` 且 `proconfig` 包含空 `search_path`；客户端表权限和函数执行权限均为 `false`；`service_role` 的读取、插入、更新及函数执行权限为 `true`，删除权限为 `false`；原有两张表的行数与迁移前一致。

## 重复执行说明

该迁移可在由本脚本创建、结构未被人工改动的数据库上重复执行：表不会重建或清空，函数会更新为脚本中的定义，权限会重新收敛到服务端最小权限，已有造型任务记录会保留。

如果数据库中已经存在一个并非由本迁移创建的同名 `style_image_jobs` 表，`create table if not exists` 不会替它补齐字段或约束。遇到这种情况应停止上线，先比较上面的约束和列定义；不要直接删除或覆盖同名表。

## 回滚方案

仅在应用尚未开始写入造型任务，或已确认不再需要保存其中结果时执行。删除新表会删除造型任务状态和缓存 URL，但不会删除或修改激活码及其使用记录。

```sql
begin;

drop function if exists public.fail_style_image_job(uuid, text, uuid);
drop function if exists public.complete_style_image_job(uuid, text, uuid, text);
drop function if exists public.claim_style_image_job(text, uuid, text, uuid);
drop table if exists public.style_image_jobs;

commit;
```

若迁移事务执行失败，PostgreSQL 会整体回滚，无需再运行上述脚本。若上线后表中已有任务数据，回滚前应先停止造型图接口并导出 `style_image_jobs` 作为备份。
