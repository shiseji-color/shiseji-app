# 造型图任务迁移操作说明

## 固定执行顺序

1. 确认两平台均显式设置 `STYLE_IMAGE_GENERATION_ENABLED=false`，并保持生产版本未发布；允许无生产流量的预览部署执行非模型检查。
2. 创建并验证生产数据备份。
3. 运行下方迁移前只读检查；任一结果不符就停止。
4. 单独执行 `database/migrate-style-image-jobs.sql`。
5. 单独执行 `database/verify-style-image-migration.sql`，确认所有布尔值为 `true`。
6. 迁移成功后仍保持造型图开关关闭，先完成应用部署和非模型冒烟检查。

不要执行 `database/activation-schema.sql` 来升级已有数据库；它用于从空数据库初始化完整结构。已有生产库只运行专用迁移文件。

## 迁移前只读检查

```sql
select
  count(*) as total_jobs,
  count(*) filter (where status = 'processing') as processing_jobs,
  count(*) filter (where status = 'completed') as completed_jobs,
  count(*) filter (where status = 'failed') as failed_jobs
from public.style_image_jobs;

select exists (
  select 1 from storage.buckets where id = 'style-images'
) as style_images_bucket_already_exists;

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'style_image_jobs'
order by ordinal_position;
```

当前上线基线要求任务总数为 `0`，且 `style-images` 桶不存在。若不满足，不要照常执行，应重新评估数据迁移和回滚方案。

## 迁移

运行：

```text
database/migrate-style-image-jobs.sql
```

脚本包含一个事务。任何语句失败时 PostgreSQL 会整体回滚，不要再运行回滚脚本。

迁移会短暂取得 `style_image_jobs` 的表级锁。当前表为空，因此约束重建和字段更新风险较低；上线后有任务数据时不要直接重复执行。

## 迁移后验证

运行：

```text
database/verify-style-image-migration.sql
```

它只读取系统目录、存储桶配置和任务表，不调用 RPC、不生成任务、不调用模型。预期：

- 任务表、7 个 RPC 和私有 `style-images` 桶均存在；
- RLS 已启用并强制执行；
- `anon`、`authenticated` 无表权限和函数执行权限；
- `service_role` 仅有读取、插入、更新和 7 个 RPC 的执行权限，无删除权限；
- 7 个 RPC 都是 `SECURITY DEFINER` 且固定空 `search_path`；
- 任务状态、结果路径和失败代码满足一致性约束。

## 保护式回滚

只有在迁移成功、但新应用尚未写入任何造型任务或文件时，才可运行：

```text
database/rollback-style-image-jobs.sql
```

回滚脚本会先检查任务表和私有桶。只要发现任何任务行或存储对象，就会抛出异常并让整个事务回滚，不会删除数据。检查通过后，它会移除新桶、`stage` / `provider_task_id` / `source_path` / `result_path` / `failure_code` 字段和 7 个新 RPC，并恢复 PR #19 使用的 3 个旧 RPC 与约束。

若新协议已经产生数据，不得运行该回滚脚本。应先关闭造型图开关、导出新增任务和文件，再另行制定数据保留或降级方案。
