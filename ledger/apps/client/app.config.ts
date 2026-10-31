import type { ConfigContext, ExpoConfig } from "expo/config";

/** QA installs alongside the regular app and never shares its Android sandbox. */
export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const qa = process.env.LEDGER_QA === "1";
  return {
    ...config,
    name: qa ? "智账 QA" : "智账",
    slug: qa ? "local-ledger-qa" : "local-ledger",
    android: {
      ...config.android,
      package: qa ? "app.local.ledger.qa" : "app.local.ledger",
    },
  };
}
