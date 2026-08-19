# shiseji-app
拾色季 AI 色彩诊断项目

## Architecture

- `index.html`: mobile-first browser application
- `api/`: serverless activation and image-analysis endpoints
- `lib/`: activation storage, signed authorization, validation and adapters
- `database/`: Supabase schema and atomic activation RPCs
- `netlify/functions/`: Netlify entry points
- `test/`: Node test suite

The browser compresses a user-selected photo and submits it only after explicit
confirmation. The server reserves one activation use in Supabase, sends the
photo to the configured Bailian vision model, validates the model response, and
returns a bounded JSON report.

After a successful diagnosis, the browser requests two independent,
identity-preserving image edits: a beauty/hair editorial and a full wardrobe
editorial. These requests reuse the short-lived analysis authorization, do not
consume extra activation uses, and can be retried independently. Complete-report
export remains unavailable until both personalized images have finished.

The image editor requires these additional server-only variables:

```sh
IMAGE_BASE_URL=https://YOUR_WORKSPACE_ID.cn-beijing.maas.aliyuncs.com/api/v1
IMAGE_MODEL_NAME=qwen-image-edit-max
```

`IMAGE_BASE_URL` must match the region of `API_KEY`. Generated temporary URLs
are downloaded only from an allowlisted provider host, stored in the private
Supabase `style-images` bucket, and returned through short-lived signed URLs.
Async provider task IDs are persisted so polling and serverless cold starts can
resume the same paid generation safely.

The same API routes work on Netlify and Vercel. Netlify dispatches diagnosis to
its background-function endpoint; Vercel publishes a small signed job to the
durable `analysis-jobs` Vercel Queue. A private queue consumer runs the same
platform-neutral worker with a 300-second execution window, while each model
request remains bounded to 45 seconds. Queue publishing uses the database task
ID as an idempotency key so a browser retry cannot enqueue a second paid job.
`vercel.json` supplies the private queue trigger, SPA fallback, and bounded
function durations. Configure the same server-only environment variables on
either platform. This repository does not deploy or apply database migrations
automatically.

## Development checks

```sh
npm ci
npm run check
npm test
```

See [SECURITY_AND_OPERATIONS.md](SECURITY_AND_OPERATIONS.md) before deployment.

## Local activation-code batches

Generate a local batch without changing Supabase:

```sh
npm run generate:activation-codes -- --count 10
```

Every generated code has exactly 6 uses. Output is written under the ignored
`private/activation-batches/` directory:

- `plaintext-inventory.csv` is the one-time plaintext sales inventory.
- `database-hashes.json` contains only hashes suitable for a later import.
- `manifest.json` records the batch ID, counts and SHA-256 file checksums.

Back up the plaintext inventory in encrypted storage before importing a batch.
Never commit, email or upload the plaintext inventory to a public service.
