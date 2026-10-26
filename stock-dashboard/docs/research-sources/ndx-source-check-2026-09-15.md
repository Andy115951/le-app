# Historical NDX official-source check: 2026-09-15

English | [简体中文](./ndx-source-check-2026-09-15.zh-CN.md)

## Scope

This is a historical, read-only source-availability record from 2026-09-15.
It is not a statement about current access or current index constituents. It is
not a candidate file and must not be imported.

## Observed official pages

- [Nasdaq NDX weighting](https://indexes.nasdaq.com/Index/Weighting/NDX)
  displayed public index-level information, but its complete constituent and
  weight data required authorized access.
- [Nasdaq NDX industry breakdown](https://indexes.nasdaq.com/Index/Breakdown/NDX)
  likewise did not provide a complete public per-security export.
- [Nasdaq NDX overview](https://indexes.nasdaq.com/Index/Overview/NDX) confirmed
  index-level information but was not a complete constituent-and-weight export.

## Historical conclusion

No candidate, database write, authenticated retrieval, or automated source
scraping was performed as part of this check. The publicly visible pages did
not meet the project's requirement for an auditable complete constituent and
weight snapshot.

## Safe follow-up

1. Obtain a complete official export through authorized access, with an
   effective date and publication time.
2. Create a candidate JSON file using the repository schema.
3. Run the existing review command and inspect its output.
4. Import only through the separate explicit approval step.

For current behavior, use `npm run ndx:source-check` and review the related
developer documentation. Do not treat this dated record as a live source
availability result.
