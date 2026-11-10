# Developer handover

## Get running

Ask Daksh for the approved remote URL, then clone `main` with `git clone <approved-repository-url>`. This workspace audit found no Git metadata. Follow the [setup guide](SETUP_GUIDE.md) to install dependencies, provision a local operator, apply migrations and start both processes. Create only synthetic records. The [contributing guide](../CONTRIBUTING.md) describes the single-branch workflow.

| Area             | Start here                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Timetable home   | [Next route](../apps/web/app/route.ts), [template and CSP](../apps/web/lib/timetable.ts), [browser client](../apps/web/timetable/client.js)                                                            |
| Academic screens | [records route group](<../apps/web/app/(records)>), [records editor](../apps/web/components/records.tsx), [resource metadata](../apps/web/lib/resources.ts)                                            |
| API              | [Express setup and CRUD](../apps/api/src/app.ts), [Zod schemas](../apps/api/src/schemas.ts), [timetable commands](../apps/api/src/timetables.ts), [validator](../apps/api/src/timetable-validation.ts) |
| Database         | [Prisma models](../apps/api/prisma/schema.prisma), [SQL migrations](../apps/api/prisma/migrations), [database notes](DATABASE_SCHEMA.md)                                                               |
| Tests            | [records integration](../apps/api/test/records.test.ts), [timetable integration](../apps/api/test/timetables.test.ts)                                                                                  |

## Harry

Start with the [CP-SAT contract and synthetic example](TIMETABLE_ENGINE.md). Implement the solver as a pure input-to-output function under [services/scheduler](../services/scheduler). First prove feasibility and report missing or infeasible inputs. Reuse Node's catalog and validator semantics. Agree on transport and a revision-safe draft apply command with Daksh after the solver works. Do not write to PostgreSQL, call publish, or add email automation as part of the solver.

## Priyanshu

Start at the live timetable and register links. Build a repeatable smoke checklist for operator sign-in, setup and allocation edits, saving a draft, reloading in another browser, and the mobile weekday view. Improve error, stale revision and empty states with synthetic records while preserving the established UI. The imported HTML is transformed by the home route and tested separately from the live browser client. Leave workbook-derived data outside Git.

## Integration checklist

- Add Express routes or commands with Zod validation and operator authorization. If the browser needs them, update the allowlisted Next proxy and API contract. Reuse the existing database client and validation logic.
- Preserve the version ID and revision check for draft writes. Edit only the working version and return it to DRAFT. Require current validation and publisher authority before snapshot publication. A catalog rename must not alter old published views.
- For schema changes, generate a new migration in disposable development, inspect SQL, preserve SQL-only constraints and triggers, then run generation and migrations locally. Do not reset a shared database or edit an applied migration.
- Run the [test procedure](SETUP_GUIDE.md#test-database), lint, typecheck, build and formatting. Check affected browser flows separately. Review the [readiness audit](IMPLEMENTATION_STATUS.md) before staging.

The weekly template has no dated approvals, no room capability model and no solver transport. Existing bearer keys are coarse-grained and catalog reads are public to reachable clients. The legacy browser export has no automatic import.
