# Sugar Notes · Mobile

English | [简体中文](./README.zh-CN.md)

A glucose and meal journal built with React Native and Expo. Android comes first, with shared routes, pages, and business rules for Web. Platform-specific files adapt date controls and session storage.

## Features

- Login, member switching, and profile management.
- Create, backdate, edit, and delete glucose and meal records, including `HI` / `LO`.
- Explicit meal links, meal reviews, saved combinations, and unsaved-change prompts.
- Food lookup, sources, images, and favorites.
- Single-meal suggestions, preference filtering, ingredient substitutions, and meal drafts.
- Date and context filters, glucose charts, and a synthetic demo mode.

## Try it locally

Use Node.js 22. From the repository root:

```sh
cd glucose-mobile
npm ci
npm run web
```

Open the URL printed in the terminal and enter demo mode to explore synthetic data. Static food references ship with the app; demo changes stay in the current session's memory.

## Cloud and web clients

The mobile app can share accounts and `glucose_` tables with [Sugar Notes Web](../glucose-app/README.md) in your own Supabase project.

Copy `.env.example` to `.env.local`. The client accepts public values only; the web origin is optional:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
EXPO_PUBLIC_WEB_ORIGIN=https://your-web.example
```

Cloud and registration targets come from your own configuration. Client keys must be public anon or publishable keys; origins must use HTTPS, with HTTP allowed only for loopback development. Registration and website links stay hidden without a web origin. See the [developer guide](./docs/public/DEVELOPMENT.md) for details.

## Validation

Run from `glucose-mobile/`:

```sh
npm test
npm run typecheck
npm run lint
npm run export:web
```

Native development and APK builds also need Java and the Android SDK; see the [developer guide](./docs/public/DEVELOPMENT.md). Web and unit-test results do not replace physical-device acceptance checks.

## Data and current scope

Android stores authentication sessions in SecureStore; Web uses localStorage under the application's origin. Health records and unsaved inputs stay in process memory. Cloud reads and saves need a network connection; static food references remain available offline.

The mobile app does not yet include full offline writes, conflict sync, export, target editing, or system reminders. Registration and enrollment open the configured web client. Production iOS builds and app-store releases are outside the currently validated scope.

Food values and sources are documented in [src/data/SOURCES.md](./src/data/SOURCES.md). The app supports lookup and journaling; it does not generate personal medical targets or glucose predictions.
