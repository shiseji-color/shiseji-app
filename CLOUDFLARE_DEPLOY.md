# Cloudflare Pages deployment

This repository can run on Cloudflare Pages without changing the browser API
paths.

## Build settings

- Framework preset: None
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

The root `wrangler.jsonc` enables `nodejs_compat`, which is required by the
activation-code hashing and the OpenAI-compatible Bailian client.

## Server environment variables

Configure these in the Pages project settings. Mark keys and tokens as
encrypted secrets.

- `API_KEY`
- `BASE_URL`
- `MODEL_NAME`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

The current application does not use Upstash, so its legacy variables are not
required by the Cloudflare deployment.

Never commit real variable values to this repository.
