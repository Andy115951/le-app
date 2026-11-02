# Validation snapshot

English | [简体中文](./VALIDATION.zh-CN.md)

Checked on 2026-11-02 using Node.js 22.22.2 and synthetic records only.

| Check | Result |
| --- | --- |
| Clean `npm ci` and manifest/lockfile agreement | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 9 tests passed |
| `npm run build:web` | Passed; desktop browser bundle generated |
| `npm run build:android` | Passed; Android Hermes bytecode generated |
| Desktop UI with a separate synthetic SQLite database | Creation, autosave, history, lock, reload, unlock, and retained history verified |
| Responsive browser layouts | Checked at desktop and phone widths; this is not a native-device test |
| Public-content checks | Diff whitespace, new source/docs review, dependency lockfile, ignored data/artifact paths, and private-value pattern check completed |

The HTTP test requires permission to connect to its own ephemeral loopback server. Android bytecode generation required normal temporary-file access outside the restrictive sandbox. Neither check contacted a production diary or cloud service. The Expo CLI wrapper disables Expo command telemetry.

## Still to verify

- Install and exercise a native Android build, including airplane-mode persistence, background locking, camera permission denial, and file picker/share behavior.
- Sync between a real Android phone and computer over Wi-Fi, including firewall behavior and network interruption. The transport protocol was exercised using a real loopback HTTP server and synthetic SQLite records.
- Build and sign a distributable APK. Native JavaScript/bytecode export does not produce an APK.
- Verify Markdown import and date recognition in the intended eDiary version. No real diary files were opened or modified.
- Exercise large-history performance on a phone. The protocol has no independent security audit, key rotation, automatic synchronization, history compaction, attachments, or secure deletion in this version.

Generated bundles, UI test data, backups, and screenshots are excluded from source. Screenshots contain synthetic text only.
