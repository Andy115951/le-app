# Read-only UI QA

English | [简体中文](./README.zh-CN.md)

From `ledger/`, run `npm run ui:qa:build`, then `npm run ui:qa`. Open the loopback preview at `http://127.0.0.1:4188/` and use a narrow browser viewport for responsive checks. The server serves only this app's generated `dist/` and accepts GET/HEAD requests; it exposes no ledger or write API.

This entry renders the production `LedgerApp`, fonts, theme, little vault and privacy controls with a fixed fictional fixture: three accounts and one reconciliation. Its view repository is read-only and rejects all financial writes/restores. It never calls `openLedger`, opens SQLite, or connects to desktop IPC. Font, vault-appearance and numeric asset-visibility preferences belong only to this browser origin. This QA entry is separate from the production client entry and is not included in ordinary Android or desktop builds.

Use it for layout, mouse/keyboard interaction, hidden-text/DOM checks, sheets and navigation. These checks do not validate Tauri storage, native Android touch cancellation, system keyboard behavior, OS background snapshots or native accessibility. Those still need their own acceptance pass with synthetic data. Keep browser work in the background while the user is working; native desktop mouse/keyboard interaction requires focus.
