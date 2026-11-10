# Implementation status and pre-push audit

Audit date: 2026-11-11. Status refers to the live Next.js/Express app. The standalone reference is a legacy prototype.

| Module                                                             | Status                     | Evidence or gap                                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Express catalog and PostgreSQL                                     | Implemented and tested     | [CRUD](../apps/api/src/app.ts), [schema](../apps/api/prisma/schema.prisma), and [records integration tests](../apps/api/test/records.test.ts). Tests exercise validation, duplicates and foreign-key protection.                             |
| Manual drafts and revision control                                 | Implemented and tested     | [Timetable commands](../apps/api/src/timetables.ts) and [integration test](../apps/api/test/timetables.test.ts) cover shared drafts and concurrent writes.                                                                                   |
| Weekly validation and immutable publication                        | Implemented and tested     | [Validator](../apps/api/src/timetable-validation.ts), [SQL triggers](../apps/api/prisma/migrations/20261110010000_timetables/migration.sql) and integration test cover conflicts, workload checks, weekly quotas, authorization and history. |
| Operator authorization                                             | Implemented and tested     | [Bearer middleware](../apps/api/src/operators.ts) and timetable integration test verify rejected anonymous writes and denied publication. Shared identity and hosting hardening remain separate.                                             |
| Academic overview and registers                                    | Implemented but unverified | [Next records screens](<../apps/web/app/(records)>) build successfully. This audit reran API tests, not browser interaction tests.                                                                                                           |
| Weekly grid and mobile weekday view                                | Implemented but unverified | [Browser client](../apps/web/timetable/client.js) and [home route](../apps/web/app/route.ts) build. This audit did not rerun multi-browser or mobile tests.                                                                                  |
| Print/PDF and browser backup export                                | Implemented but unverified | Browser print and legacy export are wired in the client. Print pagination and backup download were not exercised in this audit.                                                                                                              |
| Legacy data transition                                             | Partial                    | Browser-local data can be exported at its original origin. No mapping or automatic import of institutional schedules into database IDs.                                                                                                      |
| PostgreSQL portability to Supabase                                 | Partial                    | Standard PostgreSQL connection and migrations exist. Hosted connectivity, schema grants, extensions, TLS and migration behavior were not tested. No Supabase project configuration is present.                                               |
| Python solver and integration                                      | Planned                    | [Engine handoff](TIMETABLE_ENGINE.md). No Python implementation or registered route.                                                                                                                                                         |
| Date-specific schedules, absences, substitutions and PNG circulars | Planned                    | [Substitution handoff](SUBSTITUTION_ENGINE.md). The weekday view does not persist dated overrides.                                                                                                                                           |
| Shared hosted rollout                                              | Blocked                    | Confirm catalog visibility, operator provisioning, TLS, and institution-approved hosting before enabling access outside loopback.                                                                                                            |
| GitHub first push                                                  | Blocked                    | No Git metadata is available in the audited workspace. History, tracked files, staging and remotes cannot be verified.                                                                                                                       |

## Known limitations and debt

- Catalog GETs are public to reachable clients, including faculty and availability. Published snapshots contain the year display catalog, including allocations. Confirm exposure before hosting. Operators share broad write permissions, keys are stored in browser tab storage, and the implementation lacks per-user expiration or account management.
- Runtime schedule checks do not model room suitability, course-to-room compatibility, or regular allocation eligibility. Catalog changes can invalidate a draft. Publication revalidates, and historic displays use their snapshots.
- Legacy data access and browser sign-in depend on browser storage. Storage-disabled behavior was not exercised. Browser QA is not part of `pnpm test`.
- The integration suite passes with a pg deprecation warning about concurrent queries on a client. Investigate before upgrading to pg 9.
- The PL decisions on substitutions, batch counting, availability, eligibility and breaks are listed in [business rules](BUSINESS_RULES.md#pl-decisions).

## GitHub safety

**Push readiness: NO.** `git status` returned “not a git repository.” There was no local `.git` directory or accessible parent repository. Commit history, previously tracked data, the branch and the remote were unavailable. Restore or clone the approved repository, then inspect its history and staged file list before any push. Ignore rules do not untrack files or sanitize earlier commits.

A targeted working-tree scan checked common credential patterns and filenames, including operator token assignments, PostgreSQL URLs, Supabase key prefixes and JWTs, provider keys and private keys. Matches reviewed were local example settings, placeholders, schema fields, or dynamically generated test tokens. No live credential was identified in the scanned source. This was a pattern scan, not a proof that secrets are absent. No local non-example environment file or database dump was found among the reviewed source candidates. Dependency advisories were not audited.

The legacy workbook extract includes room, session and faculty assignment data. It remains on disk and is excluded by `.gitignore`. Next.js imports the legacy HTML and CSS, and does not load the extract. The supplied IMS logo and other institutional branding remain in the app. Confirm repository visibility and permission to distribute branding and reference materials before publishing source.

Generated clients, Next.js output, compiled API output, dependency stores, local env variants, common credential files and database dumps are excluded. The migration SQL exception keeps reviewed Prisma migrations available to developers. Do not stage private workbooks, exports or backups under different names.

## Checks run

- `pnpm db:migrate` against a disposable local test database reported no pending migrations. The timetable test applied both migrations in an isolated test schema.
- `pnpm test` passed all eight reported tests. `pnpm lint`, `pnpm build` and `pnpm typecheck` passed.
- `pnpm format:check` passed. Relative file links and coverage of all 14 Prisma models were checked.
- Next.js built from a temporary copy without the workbook extract, env files or generated output. The three solver examples parsed as JSON, and the feasible placement example passed the current full Node validator. No solver was executed.
