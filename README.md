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
