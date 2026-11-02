# Diary Inbox · 留一句

English | [简体中文](./README.zh-CN.md)

A local-first diary for Android and a desktop browser. Write a sentence offline, keep an encrypted SQLite copy on each device, and exchange entries when the computer is available. No cloud account, hosted database, analytics, or AI service is required.

## Run

Use Node.js 22.13 or newer. Install dependencies inside this directory; this project is independent of the repository root.

```sh
npm ci
npm run build:web
npm run desktop
```

Open `http://127.0.0.1:47831` on the computer. The browser is an interface to the local Node.js process; it is not the data store. SQLite is kept in the operating system's local application-data directory under `diary-inbox`. Set `DIARY_DATA_DIR` to a directory you control to override this location. Never point it at tracked repository content.

For Android development, install Java and the Android SDK, connect a development device or start an emulator, then run:

```sh
npm run android
```

This generates ignored native Android files and runs a local development build. `npm start` runs Metro for an already installed development client. A standalone release APK and signing workflow are not included in this first version. Metro is development tooling, not the diary synchronization server. The installed app stores records offline in its own SQLite database.

## Connect devices

1. Create a diary on **one device** with a separate passphrase of at least 12 characters. There is no recovery or password reset.
2. Export an encrypted `.diary` backup and import it on the other blank device using the same passphrase. Do not independently create two diaries and expect them to merge.
3. Alternatively, start the computer with `npm run desktop:lan`, open its local UI, unlock it, and generate a five-minute pairing code under **Devices and backups**. On a blank Android device, scan the code and enter the existing diary's passphrase. Only authenticated data is saved locally.
4. With both devices on the same Wi-Fi, generate a new pairing code and scan it on Android to sync. Allow the computer's port 47831 through the firewall on trusted private networks. The QR contains a temporary secret; do not share it. If multiple computer addresses appear, choose the one in the phone's subnet.
5. After Android finishes, use **Refresh received entries** on the computer to display received records. A later computer edit requires another phone sync. There is no background discovery or automatic connection in this version.

The default server binds to loopback. LAN mode exposes only the encrypted sync endpoint; the diary UI, SQLite APIs, session bootstrap, and pairing controls remain loopback-only with strict Host and Origin checks. Do not publish the process, put it behind a public proxy, or expose it through port forwarding. An empty computer can receive a phone-created diary through an encrypted backup first; then unlock it and generate a pairing code.

## Daily use

- The composer saves after a 900 ms pause. Save before switching off a device and check the saved indicator. An unsaved draft cannot survive a force-stop or power loss.
- Each note has its own date and identifier; multiple notes on the same day remain separate. Missing days do not create a backlog.
- Changes are immutable revisions. Synchronization exchanges full encrypted revision history and merges by identifier, rather than copying SQLite files. Concurrent edits remain separate heads until explicitly resolved. Choosing a conflict version opens it for editing; press Save to commit the resolution. Deletion uses a retained tombstone, and an offline edit against a deletion produces a conflict.
- Android saves and locks when backgrounded. File picker/share operations finish before locking. The desktop locks after five minutes without pointer or keyboard interaction. There is no biometric unlock, screen-capture prevention, or secure keyboard guarantee.
- Export independent encrypted backups regularly. Synchronization also propagates deletions and is not an independent backup. Old revisions are retained; there is no compaction or permanent purge yet. History is capped at 20,000 revisions and a 16 MB serialized diary per device. Transfers are whole-history snapshots, so this version targets text-only personal diaries.
- Markdown export is **plaintext** and asks for confirmation. It produces date headings and separators for manual import into eDiary. Import behavior and date recognition depend on the eDiary version; automatic eDiary import, reverse synchronization, EDF parsing, and attachments are not implemented. Review the file in eDiary before treating it as archived.

## Privacy and protocol

Diary dates, text, edit timestamps, and deletion flags are encrypted before SQLite writes using AES-256-GCM, independent random 96-bit nonces, and metadata-bound associated data. A 256-bit key is derived with PBKDF2-HMAC-SHA256, 600,000 iterations, and a random 256-bit vault salt. The passphrase is never persisted or transmitted. Random vault/revision identifiers, parent links, history size, and the KDF salt are visible. Local operating-system compromise and untrusted app/browser code are outside this protection. The application protocol has not received an independent security audit.

Pairing carries a random 256-bit secret by QR or manual copy. HTTP LAN requests and responses use an additional AES-GCM envelope with separate request/response associated data; the pairing secret is never sent in a network header. Responses bind to a random request ID, and the computer rejects replays within the pairing window. Pairing expires after five minutes or can be revoked from the UI. Traffic sizes and network addresses remain visible. Android permits cleartext HTTP only to carry these application-encrypted LAN messages; pairing input accepts private IPv4 and loopback literals, with no redirects or external hosts. Pairing is a temporary authorization to merge encrypted history, so protect the QR as a key.

The core uses [Noble Ciphers](https://github.com/paulmillr/noble-ciphers) and [Noble Hashes](https://github.com/paulmillr/noble-hashes). Android storage uses [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/); the desktop uses Node.js SQLite. No code or records are imported from other apps in this repository. Only synthetic data belongs in tests. Keep local databases, backups, exports, QR screenshots, native output, and signing material untracked.

## Validate

```sh
npm run typecheck
npm test
npm run build:web
npm run build:android
```

Tests cover encryption interoperability, wrong passphrases, tampering, concurrent histories, idempotence, deletion conflicts, atomic import, SQLite persistence, local endpoint authorization, pairing encryption, and replay rejection. Native bundling does not replace an Android device test or an APK build. See [validation](./VALIDATION.md) for the current execution results and remaining checks.
