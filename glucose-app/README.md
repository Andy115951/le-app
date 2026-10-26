# Sugar Notes · Web

English | [简体中文](./README.zh-CN.md)

A mobile-first glucose and meal journal built with Next.js, React, TypeScript, and Supabase. Look up foods, manage family member profiles, record meals, and review their linked glucose readings.

## Features

- Food GI lookup with sources, and GL estimates where the required data is available.
- Glucose records in `mmol/L` or `mg/dL`, including `HI` / `LO`.
- Create, backdate, edit, and delete meals, with explicit links to post-meal readings.
- Meal reviews and reusable saved meal combinations.
- Meal ideas filtered by allergies, avoided foods, preferences, and preparation time.
- Member switching, time zones, history charts, CSV export, and unsaved-change prompts.
- Email and password login, family access codes, and account data isolation.

## Try it locally

Use Node.js 22. From the repository root:

```sh
cd glucose-app
npm ci
npm run dev
```

Open [http://localhost:3100](http://localhost:3100). Food lookup works without cloud configuration. Open the profile tab labeled 我的 to enter demo mode.

Demo data is synthetic. Changes stay in page memory, disappear on refresh or exit, and never automatically become real records.

## Enable your own cloud records

Apply the database migrations to your own Supabase project, then copy `.env.example` to `.env.local` and set:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Your Supabase URL |
| `SUPABASE_ANON_KEY` | Public anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only administration key for account enrollment |
| `FAMILY_ACCESS_CODE` | An access code you generate and distribute privately |

Register through the profile tab's account setup flow, labeled 我的 → 开通账号. Existing accounts in the same Supabase project can sign in first and then enter the access code. Each account manages its own members and records.

See the [developer guide](./docs/public/DEVELOPMENT.md) for migration order, access rules, and deployment.

## Validation

Run from `glucose-app/`:

```sh
npm run typecheck
npm test
npm run test:db
npm run build
```

`test:db` uses a temporary PGlite database and does not connect to a live cloud project.

## Reference data and user records

Foods and meal templates are maintained with the source. See [src/data/SOURCES.md](./src/data/SOURCES.md) for numeric sources. Values without reliable data remain missing. The app does not create default medical targets or predict personal glucose levels.

Health records are stored under the signed-in account in your configured cloud database. The browser persists the authentication session, while records and unsaved inputs stay in page memory. The app supports information lookup and journaling.

## Relationship to the mobile app

[Sugar Notes Mobile](../glucose-mobile/README.md) uses Expo and supports Android and Web. Both clients can share accounts and tables in your own Supabase project. They remain separate projects with different feature coverage.
