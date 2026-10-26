# Sugar Notes Mobile developer guide

English | [简体中文](./DEVELOPMENT.zh-CN.md)

Run commands from `glucose-mobile/` unless stated otherwise.

## Environment and structure

Use Node.js 22, the dependencies pinned in `package-lock.json`, and the Expo configuration in `app.json`. The local Android build script uses Java 21 and Android SDK 36 as its development baseline.

| Path | Contents |
| --- | --- |
| `src/app/` | Expo Router pages |
| `src/components/` | Native components, charts, forms, and confirmation flows |
| `src/state/` | Login, members, records, and enrollment state |
| `src/core/` | Domain rules, cloud mapping, and pure-logic tests |
| `src/data/` | Foods, templates, sources, and synthetic data |
| `src/platform/` | Cloud client, session storage, and platform adapters |
| `assets/` | Icons and bundled food images |
| `scripts/` | Configuration, preview, and build tools |

Use `.native.ts(x)` and `.web.tsx` for platform differences. Keep business rules in `src/core/` rather than maintaining separate business pages. Install native dependencies with `npx expo install`, and check the APIs for the installed Expo version.

## Connect your own backend

Demo mode needs no cloud configuration. Real accounts and data require Sugar Notes Web's database and account-enrollment APIs to be deployed first.

Configure your own deployment targets:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase service origin |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon or publishable key |
| `EXPO_PUBLIC_WEB_ORIGIN` | Optional registration and enrollment website |

`src/core/cloud-config.ts` validates origins and public-key type. Remote services require HTTPS; HTTP is allowed only for loopback development. Registration and website links are hidden when no web origin is configured.

You can fill in the public values manually, or explicitly download them from your own web app:

```sh
npm run configure -- --web-origin https://your-web.example --supabase-url https://your-project.supabase.co
```

The script requires both the source and expected database origin, rejects redirects and mismatched targets, and writes only public client values to `.env.local`. As an alternative to CLI flags, supply `EXPO_PUBLIC_WEB_ORIGIN` and `GLUCOSE_EXPECTED_SUPABASE_URL` in the process environment. No destination is selected automatically.

Keep public client configuration in local `.env.local`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
EXPO_PUBLIC_WEB_ORIGIN=https://your-web.example
```

`EXPO_PUBLIC_` values are bundled into the client and must be public. Do not place administration keys, family codes, session-signing secrets, or signing files in the mobile project. The web service handles registration and enrollment; regular data requests use the signed-in user's JWT.

## Development and preview

```sh
npm ci
npm start
```

You can also run `npm run web` or `npm run android` for a specific platform. The dependencies include native modules, so use your own development build for native integration.

For a static Web preview:

```sh
npm run export:web
npm run preview:web
```

Output goes to `dist/`. The default preview URL is [http://localhost:8089](http://localhost:8089); a narrow-screen preview is available at [http://localhost:8089/_preview](http://localhost:8089/_preview). Export again after changing pages.

The preview entry point belongs to the local tooling, not the app's routes. Configure page-path fallback to `index.html` when deploying the Web SPA.

## Validation

```sh
npm test
npm run typecheck
npm run lint
npm run export:web
```

Automated tests cover units, time zones, meal links, combinations, substitutions, recommendations, session chunking, public-key rejection, and target validation. On a physical device, separately check login after restart, logout cleanup, the soft keyboard, system back navigation, date controls, and retries after failed saves on weak connections.

## Android builds

Configure working local Java and Android SDK environments, then run:

```sh
npm run android:build
```

The script generates `android/` through Expo, builds an arm64 release test package, and writes an APK and SHA-256 to `artifacts/`. Generated native directories and build outputs are ignored by Git.

Use `npm run android:build -- --skip-prebuild` only to resume an incremental build when the native directory exists and `app.json`, plugins, and native dependencies have not changed.

The current script uses a generated test signing key. Configure persistent signing, package identifiers, and version upgrades before distribution. Keep signing files out of Git. Expo generates `android/` and `ios/`; make configuration changes through `app.json` or a config plugin first.

## Contributing

- Add tests in `src/core/` for core-rule changes and check compatibility with the web client.
- Keep sensitive input out of logs and screenshots. Session-storage changes need rollback and logout-cleanup checks.
- Use synthetic accounts for reproductions and cloud integration; do not commit real health records.
- Maintain schema migrations through the web project and document compatibility between client versions.
