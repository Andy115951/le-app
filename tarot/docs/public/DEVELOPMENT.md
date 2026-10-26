# Candle Taro developer guide

English | [简体中文](./DEVELOPMENT.zh-CN.md)

Run commands from `tarot/` unless stated otherwise.

## Environment and accounts

Install the dependencies pinned in `package-lock.json` with `npm ci`. The app uses its own `tarot_users` and `tarot_sessions` tables. Username and password login does not use Supabase Auth's user table; optional OAuth also creates an application session.

Keep local settings in the ignored `.env.local` file. Set the corresponding server environment variables when deploying.

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database administration key |
| `SESSION_SECRET` | A separate random value for OAuth state signing and related session operations |
| `AI_PROVIDER` | Defaults to `mock`; use `deepseek` for a live model |
| `DEEPSEEK_API_KEY` | Server-side model-service key |
| `DEEPSEEK_API_URL` | Full HTTPS OpenAI-compatible chat-completions URL |
| `DEEPSEEK_MODEL` | A model name supported by your provider |

You can generate a random value locally with `openssl rand -hex 32`. Do not prefix administration, model, or session secrets with `NEXT_PUBLIC_`.

## Initialize the database

Review and apply these migrations in filename order to your own empty Supabase project:

1. [Base tables](../../supabase/migrations/20260910100000_candle_taro_init.sql).
2. [OAuth users](../../supabase/migrations/20260911170000_oauth_users.sql).
3. [Silent reveal](../../supabase/migrations/20260914090000_silent_reveal.sql).
4. [Public share tokens](../../supabase/migrations/20260915100000_public_share_token.sql).

These files define the schema; they do not contain account, reading, or conversation exports. For an existing database, check which migrations have already been applied before adding the remaining ones.

The server accesses the database through an administration client. Server APIs enforce user and guest ownership boundaries. Preserve those checks when adding APIs, and never expose the administration client to the browser.

## Models and OAuth

Start with `AI_PROVIDER=mock`. For live calls, explicitly set `DEEPSEEK_API_URL` and `DEEPSEEK_MODEL`, and verify the destination. The default URL is the public DeepSeek chat-completions endpoint; override it to use another compatible provider. Failed model requests fall back to mock content.

OAuth is optional. Configure the providers you want to enable:

- `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`.
- `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`.
- `OAUTH_BASE_URL`: your application's origin, such as `https://your-app.example`.

Register `{OAUTH_BASE_URL}/api/auth/oauth/callback` with each OAuth application. For local development, use `http://localhost:3000/api/auth/oauth/callback`. Login buttons are hidden when the corresponding provider credentials are absent.

## Testing and debugging

```sh
npm run test:draft
npm run test:history
npm run test:config
npm run test:quota
npm run test:privacy
npm run lint
npm run build
```

Draft tests use simulated localStorage; history tests use mocked requests. Neither requires a live cloud project. Configuration tests cover default and custom model targets and reject credential-bearing URLs.

If Turbopack cannot bind its internal worker port in a restricted environment, use `npm run build -- --webpack`. See the [validation snapshot](../../../docs/VALIDATION.md) for the inherited full-lint findings.

The project's `scripts/smoke-deepseek.mts` is an additional live-model check, excluded from ordinary tests. Run `npm run test:ai:live` to explicitly enable it: the command loads `.env.local` and uses the pinned TypeScript runner. It sends a synthetic question and incurs model usage charges; output is limited to chunk and character counts.

## Deployment

Create your own Vercel application, set Root Directory to `tarot`, and use the Next.js build settings. Configure the server environment, then register production callbacks if enabling OAuth.

Before release, check registration and logout, guest readings, interpretation retry, history pagination, and enabling and revoking shares in your own test environment. Provide a sharing link only after the user enables sharing.

## Vercel environment variables

1. Open the Vercel project for this app. In **Settings → Environment Variables**, add each variable name and value separately. Use Root Directory `tarot` and apply the database migrations described above before testing accounts or readings.
2. For the database and account features, configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a separate random `SESSION_SECRET`. These values belong to your own backend.
3. To use a live model, set the following values. Replace the key and model placeholders; use the HTTPS chat-completions endpoint supplied by your provider if it differs from the example:

```dotenv
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=replace-with-your-model-key
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=your-supported-model
```

4. Choose **Production** for the live site, **Preview** for preview deployments, and **Development** for Vercel local development as needed. Prefer a separate test database and model key for Preview and Development. A variable selected only for Production is not available in Preview.
5. Save the variables and create a new deployment or redeploy. Changes do not update an already built deployment. If using OAuth, also configure the optional values and callback URLs listed above.

For ordinary local Next.js development, copy `.env.example` to `.env.local` on first setup, fill in the same variable names, and restart `npm run dev` after changing them. Keep an existing local file rather than replacing it with the template. Local files are ignored by Git; values saved in Vercel are managed separately and are not copied into a new Vercel project when you copy this repository.

Keep `DEEPSEEK_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, and OAuth client secrets server-only, without a `NEXT_PUBLIC_` prefix. In Vercel, enter values in the value field, not a whole `NAME=value` line. This guide and the example file contain placeholders only.

With `AI_PROVIDER=mock`, no paid model is called, but account and reading storage still needs Supabase. The public source does not include the maintainer's model key; each deployment supplies its own. If you configure a live key for a public site, visitors' model calls use that key's allowance.

Vercel reference: [Environment variables](https://vercel.com/docs/environment-variables).

## Contributing

- Add relevant draft, history, or domain tests for changes to pure logic.
- Add a migration for schema changes and describe their effect on existing data.
- Use synthetic content in reproductions and screenshots. Do not commit real questions, conversations, sessions, or environment configuration.
- Consult the repository documentation matching the installed Next.js dependency when changing framework-specific code.

## Missing native CSS dependencies

If startup reports a missing Lightning CSS or Tailwind native module, an optional package download may have failed even when npm returned success. Retry the optional installation and check the modules before restarting the server:

```sh
npm install --include=optional
node -e "require('lightningcss'); require('@tailwindcss/oxide')"
```

The lockfile already includes supported platform packages; do not add a platform-specific package as a required dependency for all developers.
