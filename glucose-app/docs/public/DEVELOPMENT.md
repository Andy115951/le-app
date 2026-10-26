# Sugar Notes Web developer guide

English | [简体中文](./DEVELOPMENT.zh-CN.md)

Run commands from `glucose-app/` unless stated otherwise.

## Project structure

| Path | Contents |
| --- | --- |
| `src/app/` | Pages, layouts, and server-side account APIs |
| `src/components/` | State management, record forms, and page components |
| `src/lib/` | Domain rules, data mapping, and automated tests |
| `src/data/` | Foods, meal ideas, sources, and synthetic demo data |
| `public/images/foods/` | Food images bundled with the app |
| `assets/food-images/` | Image-generation notes and metadata |
| `supabase/migrations/` | Schema and access migrations |
| `scripts/` | Local database checks, setup, and deployment tools |

## Environment and runtime

Use Node.js 22 and install dependencies with `npm ci`.

```sh
npm run dev
```

Development and production servers use port 3100. Build with `npm run build`, then run the production version with `npm start`.

Food lookup and the in-memory demo remain available without Supabase configuration. Real accounts and records need cloud settings.

## Initialize the database

Review and apply these migrations in order to your own empty Supabase project:

1. [Initial schema](../../supabase/migrations/202610190001_glucose_initial.sql).
2. [Saved meal combinations](../../supabase/migrations/202610200001_glucose_meal_presets.sql).

The initial migration creates access, member, meal, reading, and favorite tables. The second adds saved meal combinations. Tables use the `glucose_` prefix; public food reference data stays in source files.

You can print the initial SQL with `node scripts/cloud-setup.mjs --sql`. The `--apply` option requires local `psql` and `GLUCOSE_DATABASE_URL`, and applies only the initial migration. Apply the saved-combination migration separately afterward. The initial migration is not a repeatedly runnable setup command.

The app uses Supabase Auth, with enrollment managed through `glucose_accounts`. Regular reads and writes use the user's JWT. RLS and composite foreign keys jointly enforce account, member, and meal ownership.

| Table | Purpose |
| --- | --- |
| `glucose_accounts` | Account enrollment and suspension state |
| `glucose_profiles` | Members, time zones, units, and food preferences |
| `glucose_meals` | Meal times, foods, and portion snapshots |
| `glucose_readings` | Original readings, units, contexts, and meal links |
| `glucose_favorites` | Member favorites |
| `glucose_meal_presets` | Reusable meal combinations |

## Environment variables and enrollment

Use `.env.example` to configure your own `.env.local`. `SUPABASE_ANON_KEY` must be a public client key. Administration keys and family codes stay on the server.

New accounts register through the page using the family code. Existing accounts sign in before enrolling. Registering an email that already exists does not grant that account access, and suspended accounts cannot reactivate themselves with the family code.

Each account can create multiple member profiles. Cross-account member sharing is not currently supported. Deleting a member or account cascades to related records; confirm the target before maintenance operations.

## Validation

```sh
npm run typecheck
npm test
npm run test:db
npm run build
```

- `npm test`: domain rules and mocked account-API security tests.
- `npm run test:db`: both migrations, constraints, and access rules in temporary PGlite.
- Builds and unit tests do not replace browser, Supabase Auth, or mobile-device acceptance checks.

`scripts/test-database.mjs` and `scripts/test-meal-presets-cloud.mjs` are additional cloud-write tests. Both require `GLUCOSE_RUN_CLOUD_TESTS=1` and an independently supplied `GLUCOSE_EXPECTED_SUPABASE_URL` matching the configured database origin. These tests create and clean up synthetic accounts and are excluded from routine local testing. `npm run test:config` checks target confirmation and deployment selection without cloud access.

## Deployment

Set Root Directory to `glucose-app` in your own Vercel project, configure the four application variables, and use the Next.js build. Check registration, enrollment, member isolation, saving, and export in a test environment before production release.

The project also provides `npm run deploy:preview` and `npm run deploy:prod`. Before using them:

1. Run `npm ci` at the repository root to install the required Vercel CLI.
2. Link your own Vercel project from this app's directory to create local `.vercel/project.json`.
3. The expected project name defaults to `glucose-app`. For a different name, supply `--project-name` or `GLUCOSE_VERCEL_PROJECT_NAME`. The selected name must match the local link.
4. Validate staging with `node scripts/deploy.mjs --dry-run --project-name your-project`.

For example, use `npm run deploy:preview -- --project-name your-project` for a custom project. Deployment commands load an existing `.env.local`; no environment file is required when values come from the shell.

The deployment script copies only build inputs and excludes environment files, deployment bindings, and dependency directories. Keep your `.vercel/` out of Git.

## Contributing

- Preserve original glucose units and `HI` / `LO`; do not turn missing values into zero.
- Give new records, saved combinations, and reused meals independent IDs and snapshots.
- Add rule tests for changes to members, dates, time zones, or meal links.
- Include sources and measurement context for food values. Use synthetic data for reproductions, screenshots, and cloud checks.
