# Candle Taro

English | [简体中文](./README.zh-CN.md)

A candlelit tarot web app built with Next.js, React, TypeScript, and Supabase. Draw cards through a ritual flow, receive streaming interpretations, ask follow-up questions, and revisit earlier readings.

## Features

- A 78-card illustrated deck and card reference, with multiple spreads and themed entry points.
- Adjustable reveal speed, interpretation detail, and silent mode.
- Streaming interpretations, follow-up questions, symbolic cards, and comparisons with earlier readings on the same question.
- Recoverable question drafts, paginated and searchable history, question groups, and local favorites.
- Username and password login, with optional GitHub / Google OAuth.
- Revocable public sharing links, share images, keepsake cards, and PWA support.

## Run locally

Use Node.js 22. From the repository root:

```sh
cd tarot
npm ci
cp .env.example .env.local
```

Initialize your own Supabase database using the [developer guide](./docs/public/DEVELOPMENT.md), then fill in `.env.local`. The minimum configuration is:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SESSION_SECRET=replace-with-a-random-secret
AI_PROVIDER=mock
```

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The `mock` provider makes no model requests, but accounts and reading records still require the database.

## Validation

Run from `tarot/`:

```sh
npm run test:draft
npm run test:history
npm run test:config
npm run lint
npm run build
```

The current automated tests cover draft recovery and history-query rules. Accounts, streaming model responses, and sharing also need integration checks in your own test environment.

## Project structure

| Path | Contents |
| --- | --- |
| `src/app/` | Pages and server APIs |
| `src/components/` | Home, spread, reading, history, and settings components |
| `src/lib/` | Accounts, storage, model calls, and domain rules |
| `src/data/` | Deck, scenes, and card-art index |
| `public/cards/` | Card images bundled with the app |
| `supabase/migrations/` | Database schema migrations |
| `test/` | Local automated tests |

See the [developer guide](./docs/public/DEVELOPMENT.md) for model configuration, OAuth, migration order, and deployment.

## Usage and data

Interpretations are for entertainment and reflection. Questions, conversations, and account details are user data; use synthetic content when reproducing issues. Enabling a live model sends relevant questions and context to the configured model service.
