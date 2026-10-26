# le-app

English | [简体中文](./README.zh-CN.md)

A collection of everyday apps for tarot, time tracking, market research, and health journaling. Each project installs its own dependencies and runs and deploys independently.

| Project | Platform and purpose | Development |
| --- | --- | --- |
| [Candle Taro](./tarot/README.md) | Web: card spreads, readings, and history | [Developer guide](./tarot/docs/public/DEVELOPMENT.md) |
| [Timing Lite](./timing-lite-tauri/README.md) | macOS: local activity and time tracking | [Developer guide](./timing-lite-tauri/docs/public/DEVELOPMENT.md) |
| [Nasdaq Dashboard](./stock-dashboard/README.md) | Web: prices, public news, and research records | [Developer guide](./stock-dashboard/docs/public/DEVELOPMENT.md) |
| [Sugar Notes Web](./glucose-app/README.md) | Web: glucose, meals, and member profiles | [Developer guide](./glucose-app/docs/public/DEVELOPMENT.md) |
| [Sugar Notes Mobile](./glucose-mobile/README.md) | Android / Web: cross-platform health journaling | [Developer guide](./glucose-mobile/docs/public/DEVELOPMENT.md) |

## Getting started

Use Node.js 22, then follow the README inside the project you want to work on. The repository is not an npm workspace: running `npm ci` at the root installs the shared Vercel CLI, not every project's dependencies.

The desktop app also needs Rust and macOS build tools. Building the Android app needs Java and the Android SDK. Web projects offer local demo or mock workflows where available before you configure your own cloud services.

## Configuration and data

Environment templates contain variable names and example values. Each developer keeps their own `.env.local`; deployment bindings stay in local `.vercel/` directories. User data, database exports, signing files, and real environment configuration are excluded from source distribution.

Model and cloud targets are supplied by each deployment. The project guides describe configuration and target-validation requirements. Live model calls, cloud writes, and production deployments are outside the default test workflow.

## Contributing

Include the project name, reproduction steps, and expected behavior in issues. Use synthetic data and redacted screenshots. Keep each PR focused on one project or a shared change, and explain how it was validated. Add migrations for database changes and describe their impact on existing data and other clients.

English is the source version of the public documentation. Keep the Simplified Chinese translation aligned when changing behavior, commands, or configuration instructions.

Retain sources for food values, news, and market data, along with notices for third-party assets and dependencies.

## License

Original code is licensed under [MIT](./LICENSE). See [third-party notices](./THIRD_PARTY_NOTICES.md) for retained dependency and reference-data notices.

Validation results and remaining limitations are recorded in the [migration validation snapshot](./docs/VALIDATION.md).
