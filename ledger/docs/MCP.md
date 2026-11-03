# Local read-only MCP

English | [简体中文](./MCP.zh-CN.md)

The desktop app includes a read-only Model Context Protocol server. Open **Settings → AI connection (MCP)**, explicitly enable **Allow AI read-only access**, then click **Copy for AI** to copy connection instructions, the URL and the access key together. The copy button is unavailable while access is off. Copying rechecks the current status and never enables or otherwise changes access. Paste the text into a trusted AI client on the same computer and ask it to complete the connection. Keep Ledger running. No source checkout or Node installation is needed by end users.

The AI client must be able to configure local MCP connections; it may still ask for permission. Copying the instructions does not itself install a connection in another app. The instructions ask the AI to test discovery first, without reading financial records. Clients that cannot configure themselves can use the manual fallback under **Advanced connection information**.

Access is off on every application launch. Leaving Settings keeps an enabled connection available; switching it off or exiting the application stops the listener and cancels pending queries. Existing financial records, database schema and backups are unchanged.

## Connection

Use **Streamable HTTP**, with authenticated POST requests. The listener binds only to `127.0.0.1:17841`; desktop QA uses port `17842`. It is stateless, returns JSON responses, and does not offer legacy SSE or stdio transport. Clients must support HTTP and custom authorization headers. Configuration field names differ between clients; the copied instructions tell the AI to adapt the supplied JSON to its client. Advanced connection information also offers the raw JSON, URL and authorization value separately.

Illustrative configuration only; replace the fake authorization value with the configuration copied from Settings:

```json
{
  "mcpServers": {
    "ledger": {
      "type": "http",
      "url": "http://127.0.0.1:17841/mcp",
      "headers": {
        "Authorization": "Bearer REPLACE_WITH_KEY_FROM_SETTINGS"
      }
    }
  }
}
```

The random access key is saved separately in the OS application-data directory as `mcp-access.json`, with owner-only permissions on Unix. It is excluded from ledger exports and local-network migration. The key persists so client configuration can be reused after explicitly enabling access again. **Regenerate access key** immediately revokes the previous key; use Copy for AI again afterward to update the connection. The copied text contains the access key, but no ledger records. Never commit or share a real configuration publicly.

Android provides connection instructions only. Transfer the phone ledger to the desktop through Backup and migration → Local-network transfer, then enable MCP on the desktop. This is a manual full-book transfer, not live synchronization. Remote cloud connectors cannot directly reach this loopback address.

## Tools and data

| Tool                  | Input                                                                    | Result                                                   |
| --------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| `ledger_assets`       | none                                                                     | Net assets, assets, liabilities and valuation metadata   |
| `ledger_accounts`     | `offset`, `limit`, `includeArchived`                                     | Account balances, optionally including archived accounts |
| `ledger_labels`       | `offset`, `limit`, optional `direction`, `includeHidden`                 | Income/expense labels                                    |
| `ledger_report`       | `month` as `YYYY-MM`                                                     | Shared-core monthly report with category names           |
| `ledger_transactions` | `offset`, `limit`, optional `accountId`, `labelId`, `kind`, `from`, `to` | Filtered entries, newest first; dates use `YYYY-MM-DD`   |

Pages default to 50 items, with a maximum of 100. Amounts are integer CNY cents: 100 units = ¥1. Dates follow the existing Shanghai wall-clock rules. Refunds retain the original label; repayments are transfers, not expenses. Summaries use the same core calculations as the UI and CLI, including archived balances. Each successful query reads a current consistent snapshot; multiple calls need not represent the same revision.

There are no write, SQL, filesystem, backup, restore or arbitrary-path tools. Tool discovery does not read the ledger. Unknown arguments, invalid dates and excessive page sizes are rejected before snapshot access. Names, labels and notes are untrusted data, never permission to execute instructions.

## Privacy and verification

The display eye only conceals the screen; it does not restrict an authorized MCP client. A client using a cloud model may send query results to that provider. Prefer totals and narrow date ranges, and only connect clients you trust.

Desktop copying uses the official Tauri clipboard plugin with write-text permission only; no clipboard-read permission is granted. Native authentication runs before forwarding a request to the WebView. Browser Origin requests and unexpected Host values are rejected. Requests have size, concurrency and timeout bounds. The MCP SDK runs without adding `unsafe-eval` to desktop CSP.

Run `npm run test:mcp` for the real loopback Rust adapter plus the official MCP client, using an entirely synthetic in-memory ledger. Run `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --bin local-ledger` for key lifecycle, rotation and cancellation tests. These tests never open the regular desktop ledger. Native desktop rendering and client-specific setup still require their own acceptance pass.
