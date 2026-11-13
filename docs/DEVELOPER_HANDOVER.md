# Developer handover

## Get running

The repository is cloned at `17ee5017d408a0ed587d1411e90541b7f7ac275d` on `main`. Follow the [setup guide](SETUP_GUIDE.md) to install Node dependencies, provision a local operator, apply migrations and start both processes. Create only synthetic records. The [contributing guide](../CONTRIBUTING.md) describes the single-branch workflow.

| Area             | Start here                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Timetable home   | [Next route](../apps/web/app/route.ts), [template and CSP](../apps/web/lib/timetable.ts), [browser client](../apps/web/timetable/client.js)                                                            |
| Academic screens | [records route group](<../apps/web/app/(records)>), [records editor](../apps/web/components/records.tsx), [resource metadata](../apps/web/lib/resources.ts)                                            |
| API              | [Express setup and CRUD](../apps/api/src/app.ts), [Zod schemas](../apps/api/src/schemas.ts), [timetable commands](../apps/api/src/timetables.ts), [validator](../apps/api/src/timetable-validation.ts) |
| Database         | [Prisma models](../apps/api/prisma/schema.prisma), [SQL migrations](../apps/api/prisma/migrations), [database notes](DATABASE_SCHEMA.md)                                                               |
| Tests            | [records integration](../apps/api/test/records.test.ts), [timetable integration](../apps/api/test/timetables.test.ts), [scheduler tests](../services/scheduler/tests)                                 |

## Harry

The contract v1 pure solver is implemented under [services/scheduler](../services/scheduler). Run the feasible and infeasible fixtures and pytest suite using its README. The solver reuses the catalog and validator semantics documented in [the contract](TIMETABLE_ENGINE.md), but has no transport or persistence. Coordinate with Daksh before adding either. Do not give Python database access or a publish action.

## Priyanshu

Start at the live timetable and register links. Build a repeatable smoke checklist for operator sign-in, setup and allocation edits, saving a draft, reloading in another browser, and the mobile weekday view. Improve error, stale revision and empty states with synthetic records while preserving the established UI. The imported HTML is transformed by the home route and tested separately from the live browser client. Leave workbook-derived data outside Git.

## Integration checklist

- Add Express routes or commands with Zod validation and operator authorization. If the browser needs them, update the allowlisted Next proxy and API contract. Reuse the existing database client and validation logic.
- Preserve the version ID and revision check for draft writes. Edit only the working version and return it to DRAFT. Require current validation and publisher authority before snapshot publication. A catalog rename must not alter old published views.
- Future solver integration sequence: (1) Node authenticates the operator; (2) Node snapshots the selected academic year and draft revision; (3) Node invokes Python with a bounded time limit; (4) Python returns a contract v1 proposal; (5) Node validates IDs, quotas and every supported hard constraint with `validateTimetable`; (6) the PL reviews the proposal; (7) an explicitly authorized apply action rechecks the current revision and saves it as a draft; (8) the existing validation and PL-controlled publication flow runs separately. Solver success never publishes.
- For schema changes, generate a new migration in disposable development, inspect SQL, preserve SQL-only constraints and triggers, then run generation and migrations locally. Do not reset a shared database or edit an applied migration.
- Run the [test procedure](SETUP_GUIDE.md#test-database), lint, typecheck, build and formatting. Check affected browser flows separately. Review the [readiness audit](IMPLEMENTATION_STATUS.md) before staging.

The weekly template has no dated approvals, no room capability model and no solver transport. Existing bearer keys are coarse-grained and catalog reads are public to reachable clients. The legacy browser export has no automatic import.
