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

1. Set `STYLE_IMAGE_GENERATION_ENABLED=false` on both platforms.
2. Deploy the reviewed commit to Vercel without production traffic and verify
   static pages plus non-model 405/403/503 API behavior. Confirm a synthetic
   queue message can be published and acknowledged before any paid model test.
3. Deploy the same commit to Netlify. Confirm style-image calls return 503 and
   existing activation/status traffic remains healthy.
4. Create and verify the production database restore point.
5. Apply `database/migrate-style-image-jobs.sql` once. Do not retry blindly if
   the transaction fails; capture the fixed database error and investigate.
6. Run the read-only checks in `database/verify-style-image-migration.sql`.
7. Set `STYLE_IMAGE_GENERATION_ENABLED=true` on Netlify only.
8. Run one explicitly approved, budget-capped end-to-end production smoke test:
   analysis, beauty, outfit, polling recovery, signed image access, and retry.
9. Observe errors, latency, storage writes, and provider spend for 30 minutes.
10. Enable the Vercel fallback, repeat the approved smoke test there, and only
    then configure or verify traffic failover.

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
