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

Never expose these values to browser code or commit them to Git.

## Database migration

Apply `database/migrate-style-image-jobs.sql` to an existing installation (or
`database/activation-schema.sql` to a new installation) before deploying the
matching application release. The migration creates the private `style-images`
bucket and resumable job RPCs. Deploying application code before the migration
will make image requests fail safely.

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

1. Run `npm ci`, `npm run check`, and `npm test`.
2. Apply and verify the database migration.
3. Deploy to one documented production platform.
4. Smoke-test activation, eligible and ineligible photos, timeout/refund, and
   poster export.
5. Verify security headers and WAF rules on the public domain.
6. Record the deployed commit and rollback procedure.
