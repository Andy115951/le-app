# Repository instructions

English | [简体中文](./AGENTS.zh-CN.md)

## Public repository — applies to every project

**le-app is a public GitHub repository. Write every tracked file and commit as material that anyone may read, copy, and retain. Never commit private information or real credentials.**

These rules apply throughout the repository, including source code, documentation, tests, fixtures, examples, scripts, assets, and database migrations. Follow additional project instructions in nested `AGENTS.md` files as well.

### Keep private material out of public content

- Never include real API keys, database connection credentials, service-role keys, OAuth secrets, SMTP authorization codes, proxy credentials, session or access tokens, cookies, private keys, or signing material. Treat URLs containing credentials or subscription tokens as secrets too.
- Never use real family profiles, health readings, personal meal records, holdings, cost basis, trading notes, tarot questions or conversations, activity history, database exports, or production logs as examples or fixtures. Use synthetic data with clearly fictional identities.
- Keep personal email addresses, phone numbers, device paths, internal hosts, and private operational notes out of documentation, screenshots, filenames, and test output. Use reserved example domains, placeholders, and the author's GitHub noreply identity where an author email is needed.
- Do not copy private material from local configuration, ignored directories, the old repository, cloud dashboards, or other conversations into this repository. Review imported documents and assets before adding them.

### Configuration and public APIs

- Keep real configuration in ignored local environment files or deployment secret stores. Commit only `.env.example` templates with variable names and clearly fake values. Keep `.vercel/`, local databases, exports, debug traces, and signing files untracked.
- `.gitignore` does not protect files already tracked or values copied into source. The `private` field in `package.json` controls npm publishing; it does not make this GitHub repository private.
- Keep privileged credentials server-only. A public client key must be intended for browser use and protected by database access policies; do not assume an unpublished database URL or table name is an access control.
- For changes to shared database access or public configuration responses, verify that anonymous clients cannot access private records in any affected app. Use synthetic data or zero-row permission checks; do not retrieve user content for examples or diagnostics.

### Before sharing changes

- Review the full diff and every newly added file, including untracked files intended for the commit. Check screenshots, generated assets, logs, attachments, and commit author/committer fields as well as code.
- Apply the same privacy rules to commit messages, pull requests, issues, CI logs, and release artifacts. Keep public developer documentation in English with an aligned Simplified Chinese translation.
- During an audit, report suspect locations and credential types without printing secret values or personal records. Report suspected exposure promptly; follow the user's authorized remediation scope. Removing a file from the latest commit does not remove it from earlier history or retract copies already made.
