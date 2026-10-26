# Nasdaq Dashboard product roadmap

English | [简体中文](./ROADMAP.zh-CN.md)

## Purpose

Nasdaq Dashboard is a research and learning workspace for Nasdaq-100 market
information. It organizes observable facts, source links, personal notes, and
decision records. It does not place orders, infer a single cause for a price
move, or generate trading instructions.

## Current product baseline

- A public market radar covers quotes, news, price history, the trading
  calendar, earnings, and NDX constituent changes.
- Personal workflows cover watchlists, groups, position context, drawdown
  rules, observations, and decision logs. These remain local by default and
  can use optional account sync.
- Research workflows retain dated evidence, distinguish known data from missing
  data, and expose historical features, comparable days, and deterministic
  reports without treating them as forecasts.
- Optional server-side collection supports public market data, filings, and
  macro observations. Imports and backfills remain explicit maintenance work.
- Optional model explanations are separated from deterministic research. They
  require configuration and a deliberate user action or server-side approval
  gate, depending on the feature.

## Priorities

### 1. Evidence quality and reliability

- Preserve source URLs, market dates, and review status.
- Keep absent prices and unverified events visibly absent instead of inventing
  a value or explanation.
- Improve collection observability while keeping protected operational details
  server-only.
- Treat NDX constituent updates as human-reviewed imports, not automatic
  scraping.

### 2. A clearer daily market view

- Make the relationship between the Nasdaq benchmark, core stocks, news, and
  scheduled events easier to inspect on a specific market date.
- Keep price comparisons descriptive. A same-day difference is not tracking
  error, causality, or a forecast.
- Continue separating intraday observations from completed market-day facts.

### 3. Beginner-friendly learning

- Explain terminology in plain language without removing advanced research
  views.
- Keep the guided reading manual and grounded in the facts visible on the page.
- Show uncertainty and empty states honestly rather than filling gaps with a
  narrative.

### 4. Controlled model assistance

- Use models only to explain bounded, evidence-backed inputs.
- Keep model output separate from source facts and reject unsupported
  predictions, target prices, and buy/sell language.
- Preserve explicit enablement, data-transfer, and audit boundaries before
  expanding model features.

### 5. Personal decision discipline

- Help users record their own observations and decisions with context.
- Improve review of past decisions without labelling an outcome as proof that a
  decision was right or wrong.
- Keep personal holdings and credentials out of public research, exports, and
  issue reports.

## Deliberate non-goals

- Automatic order placement or brokerage integration.
- A claim that a news item caused a market move.
- Silent model requests using personal positions, cost basis, or credentials.
- Automatic database imports, destructive backfills, or production repairs
  initiated from the browser.

## Planning notes

This is a direction document, not a production-status report. Database
migrations, backfills, collection runs, and optional model features must be
verified independently in each deployment environment. See the
[developer guide](./public/DEVELOPMENT.md) for setup and maintenance limits.
