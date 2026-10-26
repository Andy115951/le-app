# Guided reading

English | [简体中文](./beginner-reading.zh-CN.md)

## What it is

Guided reading is a manually requested explanation of the facts already shown
in the dashboard. It is designed to help a newer market participant read a
market day without hiding the advanced research views.

The deterministic reading has five fixed sections:

1. The Nasdaq benchmark and observed volatility context.
2. Core-stock moves relative to QQQ.
3. Public news and earnings-calendar context.
4. Mature historical comparison samples, when available.
5. The user's own configured observations, when present.

## How to use it

1. Open the home view or a dated market-day view.
2. Select **Read today** or the equivalent date-specific action.
3. Review the generated factual sections and their linked source material in
   the dashboard.
4. If the optional model explanation is enabled, select **Generate AI
   explanation** and explicitly confirm the request.

The reading is generated only after an action. Refreshing quotes or opening the
page does not silently create it.

## Model-explanation boundary

The optional explanation is a separate layer underneath the five factual
sections. It is not new market data and does not replace source material.

- The confirmation step sends the five displayed factual sections for
  explanation.
- Position quantity and cost basis are excluded from that request.
- If the feature is disabled, unavailable, or rejected by validation, the
  deterministic reading remains available.
- The implementation rejects trade instructions, target prices, probability
  claims, and unsupported causal wording.

## Reading the result responsibly

- A linked news item is evidence to inspect, not proof that it caused a price
  movement.
- Historical outcomes describe completed samples, not a prediction for the
  current market day.
- A scheduled earnings date is a calendar fact, not an explanation for a
  current price move.
- Missing data stays visible as missing. The reading does not guess a
  substitute value or reason.

Guided reading is educational material and not investment advice.
