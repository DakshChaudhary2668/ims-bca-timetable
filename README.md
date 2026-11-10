# IMS Ghaziabad UCC · BCA Timetable

A workspace for the BCA Programme Leader to maintain academic records, assemble a weekly timetable, validate it, and publish immutable versions. PostgreSQL stores the shared records and drafts. The daily view filters a weekly timetable by weekday.

## What runs today

- Academic-year, semester, section, teaching-group, subject, quota, faculty, room, slot and availability registers.
- Manual weekly timetable editing with section, faculty and room views, shared drafts and revision checks.
- Server validation and operator-authorized publication with immutable history. The UI includes browser print/PDF.

Automatic generation, dated overrides, substitution approvals and managed hosting are future work. See the [implementation status](docs/IMPLEMENTATION_STATUS.md).

## Stack and layout

| Path                          | Purpose                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                    | Next.js App Router, React, TypeScript, Tailwind, and the timetable's existing HTML, CSS and browser JavaScript         |
| `apps/api`                    | Express, TypeScript, Zod, Prisma 7 with the pg adapter, and PostgreSQL                                                 |
| `apps/api/prisma`             | Prisma schema and ordered SQL migrations                                                                               |
| `services/scheduler`          | Python solver handoff. Google OR-Tools CP-SAT is planned                                                               |
| `references/master-timetable` | Legacy source HTML and CSS used by Next.js. The standalone app additionally needs a private workbook-derived data file |
| `docs`                        | Product, implementation, setup and policy references                                                                   |

## Quick start

Use Node.js 24 LTS, pnpm 11.25.0 and PostgreSQL with `btree_gist`. Create an empty local development database and a separate disposable test database. From the repository root:

```sh
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
```

Set the local `DATABASE_URL` and provision named `IMS_OPERATORS` in the ignored environment file. Then run:

```sh
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Open [the timetable](http://127.0.0.1:3000/) and sign in with an operator key. Enter the academic year, semesters, sections, explicitly scoped teaching groups, rooms and slots in **Academic setup**. Configure subject quotas, faculty allocations and availability before validating a draft. The [setup guide](docs/SETUP_GUIDE.md) covers credentials, ports and the planned Supabase setup.

## Workspace scripts

| Script                             | Purpose                                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                         | Starts both loopback development servers                   |
| `pnpm build`                       | Builds the Express output and Next.js production bundle    |
| `pnpm db:generate`                 | Generates the Prisma client                                |
| `pnpm db:migrate`                  | Applies committed migrations to the configured database    |
| `pnpm lint`, `pnpm typecheck`      | Checks app source and types                                |
| `pnpm test`                        | Runs the API integration suite against `TEST_DATABASE_URL` |
| `pnpm format:check`, `pnpm format` | Checks or applies Prettier formatting                      |

Use a migrated disposable database for tests. The timetable test also creates and drops its own schema. [Test setup](docs/SETUP_GUIDE.md#test-database)

## Handover

- [Developer handover](docs/DEVELOPER_HANDOVER.md), [contributing](CONTRIBUTING.md), [agent instructions](AGENTS.md)
- [Product](docs/PRODUCT.md), [roles](docs/USER_ROLES.md), [business rules](docs/BUSINESS_RULES.md)
- [Architecture](docs/ARCHITECTURE.md), [database schema](docs/DATABASE_SCHEMA.md), [API contracts](docs/API_CONTRACTS.md), [decisions](docs/DECISIONS.md)
- [Timetable engine](docs/TIMETABLE_ENGINE.md), [substitution engine](docs/SUBSTITUTION_ENGINE.md)
- [Implementation status and GitHub audit](docs/IMPLEMENTATION_STATUS.md)
