# Production release runbook

This runbook is a plan, not an automatic deployment. Never paste secrets into
commands, logs, tickets, or pull requests. Record the release commit, operator,
timestamps, backup identifier, and outcome in the private operations log.

## Release gates

- PR remains unmerged until review and all required checks pass.
- Production backup/PITR restore point is verified and named.
- Netlify and Vercel contain identical server-only environment variables.
- The Vercel deployment exposes an `analysis-jobs` queue consumer in
  Observability, and `api/analysis-worker.js` is not publicly routable.
- `STYLE_IMAGE_SOURCE_HOSTS` is narrowed to the observed provider result hosts.
- Platform WAF/rate and spend alerts are configured.
- A rollback owner and a 30-minute observation window are assigned.

## Coordinated order

1. Explicitly set `STYLE_IMAGE_GENERATION_ENABLED=false` on both platforms.
   A missing or malformed value must also keep generation disabled.
2. Create and verify the production database backup/PITR restore point, then
   complete the pre-migration read-only checks.
3. If needed, deploy the reviewed commit only to preview/no-traffic targets and
   verify static pages plus non-model 405/403/503 API behavior. Do not publish
   queue messages or call a paid model before the migration is verified.
4. Apply `database/migrate-style-image-jobs.sql` once. Do not retry blindly if
   the transaction fails; capture the fixed database error and investigate.
5. Run `database/verify-style-image-migration.sql`; all seven RPCs, constraints,
   RLS, grants, and the private bucket must pass.
6. Deploy the reviewed commit to Netlify with generation still disabled. Verify
   activation, analysis status, privacy pages, export/save, and 503 behavior
   without invoking a model.
7. Set `STYLE_IMAGE_GENERATION_ENABLED=true` on Netlify only.
8. Run one explicitly approved, budget-capped end-to-end production smoke test:
   analysis, beauty, outfit, polling recovery, signed image access, and retry.
9. Observe errors, latency, storage writes, and provider spend for 30 minutes.
10. Deploy and enable the Vercel fallback, repeat the approved smoke test there,
    verify worker routes reject public requests, and only then verify failover.

## Abort and rollback

- Before the migration: redeploy the previous application commit and leave the
  generation switch off until stable.
- After the migration but before enabling generation: keep the switch off and
  fix forward. Do not restore the whole database unless the migration damaged
  unrelated production data.
- After enabling generation: disable the switch first. Preserve job rows and
  provider task IDs for diagnosis; never delete or reset them to force retries.
- A database restore is the last resort because it can discard activation and
  analysis writes made after the restore point. It requires separate approval.

## Evidence to retain

- CI URLs and exact deployed commit
- backup/restore-point identifier
- migration start/end and verification output
- platform deployment identifiers
- smoke-test request IDs (never activation codes, tokens, or photos)
- error-rate, latency, spend, and rollback decision
