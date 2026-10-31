# Local-network ledger transfer

English | [简体中文](./LAN_TRANSFER.zh-CN.md)

Open **Settings → Backup and migration → Local-network transfer** on both devices. The desktop (macOS or Windows) creates the connection; the Android phone chooses the transfer direction. Devices retain independent books until the recipient explicitly confirms replacement. There is no account, cloud relay, automatic merge, background synchronization, or selection of the newest ledger.

## Use

1. Connect both devices to the same private IPv4 network. On the desktop, choose **Open one-time connection**. If the operating system asks for local-network access, allow it for this connection. For multiple interfaces, select the address reachable from the phone.
2. On the phone, scan the desktop QR code or paste its connection code, then connect. Camera permission is requested only when opening the scanner and is optional with manual code entry.
3. Review the two book summaries and choose **Phone → Desktop** or **Desktop → Phone**. The desktop shares the snapshot captured when opening the connection; the phone sends the snapshot shown at connection time and refuses sending if its book changed meanwhile.
4. On the receiving device, review the incoming counts and confirm **Back up original book and replace this device**. Full backup validation, destination-token checking, original-book backup, and replacement use the existing SQLite restore transaction. A changed destination refuses replacement; close and reconnect for a new preview.
5. Wait for completion before continuing to record. Close the connection when finished. The original book is available under **Automatic backups**, with the same preview/restore flow as JSON imports. Previous automatic backups and device appearance/privacy preferences are not transferred.

Each connection accepts one phone and one whole-book transfer, expires after ten minutes, and stops when the desktop leaves this page or exits. A phone leaving the page discards its client state; reopen the desktop connection before pairing again. An interrupted transfer never triggers automatic replacement. After replacement, acknowledgement retries only resend the completion notification, never repeat the restore. If notification cannot arrive, the receiving device's local success message remains authoritative; reconnect before another transfer.

If connection fails, check the selected desktop address, same-network connectivity, firewall permission, client isolation on guest Wi-Fi, and code expiry. No router port forwarding is required. IPv6-only networks, phone-to-phone hosting, automatic device discovery, ordinary-browser hosting, iOS acceptance and incremental merging are outside this implementation.

## Transport boundary

The desktop's native Rust listener binds an ephemeral port while active. The pairing code contains a random 256-bit secret shared out of band. It grants access to the captured book for this session; keep it with the intended device. Neither the code nor key is written to application logs or financial storage.

HTTP transports AES-256-GCM authenticated envelopes, not plaintext backups. Each envelope uses a fresh 96-bit nonce and 128-bit tag, with different authenticated context strings for requests and responses. Replies bind the request ID. The server rejects replayed request nonces, other client IDs, changed transfer IDs/directions, browser Origin requests, other HTTP paths, chunked bodies, and oversized requests. Header/body limits and timeouts bound incoming connections. The pairing key is never sent in an HTTP header, URL, or body; encryption uses Expo Crypto on Android and RustCrypto on desktop. JSON files exported separately and SQLite storage retain their existing unencrypted-at-rest behavior.

Backups are limited to 20 MB on desktop, and encrypted wire envelopes to 28.1 MB. The server validates the container before staging; the shared core fully validates data before the recipient writes it. The listener does not open a database or call restore. Only the receiving UI can commit a replacement.

## Verification

Run `npm test`, `npm run typecheck`, `npm run test:lan`, and `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --bin local-ledger` from `ledger/`. The integration harness binds loopback only and uses generated in-memory ledgers. It tests actual Rust HTTP ↔ TypeScript encryption in both directions, no write before confirmation, original-book recovery, retries, rejection, stale-token protection, authenticated replay/reflection rejection, and listener closure. Unit checks cover malformed codes, wrong response IDs, authenticated tampering, expiry and size limits.

Use isolated QA builds for native acceptance. Never export, replace, or inspect a regular user's book for a test fixture. Android camera/native-AES interoperability and physical-device Wi-Fi/firewall behavior require a connected device; compilation and loopback tests alone do not prove these paths.
