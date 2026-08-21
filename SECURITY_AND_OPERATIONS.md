# Security and operations checklist

The application handles facial photos and paid activation codes. Complete this
checklist before deploying a release.

## Required environment variables

- `API_KEY`: Bailian API key
- `BASE_URL`: Bailian OpenAI-compatible endpoint
- `MODEL_NAME`: approved vision model
- `SUPABASE_URL`: production Supabase URL
- `SUPABASE_SECRET_KEY`: server-only Supabase secret
- `AUTH_TOKEN_SECRET`: at least 32 random characters, unique per environment
- `IMAGE_BASE_URL` and `IMAGE_MODEL_NAME`: approved asynchronous image endpoint/model
- `STYLE_IMAGE_SOURCE_HOSTS`: optional comma-separated generated-image host allowlist
- CSP permits stored report images only from `*.supabase.co`; if production uses a custom Supabase storage domain, add that exact host to both platform configs before release
- `STYLE_IMAGE_GENERATION_ENABLED`: generation is enabled only by the exact value `true`; keep it explicitly `false` during migration and initial release

Never expose these values to browser code or commit them to Git.

## Database migration

Apply `database/migrate-style-image-jobs.sql` to an existing installation (or
`database/activation-schema.sql` to a new installation) before releasing the
matching application to production traffic. A preview/no-traffic deployment may
be used first for static and non-model checks while generation remains disabled.
The migration creates the private `style-images` bucket and seven resumable job
RPCs. Do not enable generation until the read-only verification passes.

Back up the database before applying a production migration. Enable Supabase
point-in-time recovery where available and perform a documented restore test at
least quarterly.

## Platform controls

The in-process rate limiter is a first line of defense only; serverless
instances do not share memory. Configure platform-level rate limiting or WAF
rules for:

- `POST /api/verify-code`: per-IP and global limits
- `POST /api/analyze`: per-IP, per-token, concurrency, and request-size limits
- `POST /api/generate-style-image`: per-IP, per-token, concurrency, and spend limits

Configure alerts for elevated 403/429/5xx rates, model spend, latency, and
refund failures. Logs must never include activation codes, tokens, photos,
request bodies, API keys, or database secrets.

## Privacy

Confirm the published privacy policy names the cloud/AI processors, describes
the purpose and retention period, and provides a deletion/contact channel.
Verify provider-side logging and data-retention settings before production.

## Release

1. Run `npm ci`, high-severity `npm audit`, `npm run check`, `npm test`,
   `npm run build`, dependency review, and CodeQL. Confirm repository secret
   scanning/push protection is enabled in GitHub settings.
2. Keep generation disabled, verify the restore point, then apply and verify the
   database migration.
3. Deploy to one documented production platform with generation still disabled
   and complete all non-model regression checks.
4. Enable one platform only and run the separately approved, budget-capped smoke
   test for activation, eligible/ineligible photos, timeout/refund, and export.
5. Verify security headers, worker route rejection, WAF rules, and spend alerts
   on the public domain; observe for 30 minutes before enabling failover.
6. Record the deployed commit, evidence, and rollback procedure.
