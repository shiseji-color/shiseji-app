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
