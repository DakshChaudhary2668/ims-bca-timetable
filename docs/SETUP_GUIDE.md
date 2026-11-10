# Setup guide

## Local development

Install Node.js 24 LTS, pnpm 11.25.0 and PostgreSQL with `btree_gist` available. Use separate development and test databases owned by your local development role. For example, after connecting as that role with `psql`:

```sql
CREATE DATABASE ims_bca;
CREATE DATABASE ims_bca_test;
```

Clone the approved GitHub repository when its URL is available. From its root:

```sh
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
pnpm db:generate
```

| Variable            | Location               | Purpose                                                                                                                 |
| ------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | `apps/api/.env`        | Prisma CLI and runtime PostgreSQL URL. The adapter also reads an optional `schema` query parameter.                     |
| `PORT`              | `apps/api/.env`        | Express loopback port, default 4000                                                                                     |
| `IMS_OPERATORS`     | `apps/api/.env`        | JSON array of named `{id,token,publish}` records. IDs and tokens must be unique. Empty defaults to read-only operation. |
| `API_ORIGIN`        | `apps/web/.env.local`  | Server-side Express origin, default `http://127.0.0.1:4000`                                                             |
| `TEST_DATABASE_URL` | Test shell environment | Dedicated disposable PostgreSQL target                                                                                  |

Use a URL of the form `postgresql://<local-role>:<password>@127.0.0.1:5432/ims_bca`. URL-encode password characters as needed. Generate each operator key with `openssl rand -hex 32` and enter it only in the ignored env file. Assign `publish:true` only for an approved publisher. Restart Express after changing environment settings.

Verify the target is local and then run `pnpm db:migrate` followed by `pnpm dev`. The browser opens the Next.js app on port 3000. The Express health endpoint is on port 4000. To change the API port, update both `PORT` and `API_ORIGIN`. To serve built artifacts locally, run `pnpm build`, then start each workspace with `pnpm --filter @ims/api start` and `pnpm --filter @ims/web start` in separate terminals.

## Migration workflow

Create a new migration against a disposable development database with `pnpm --filter @ims/api exec prisma migrate dev --create-only --name <name>`. Review the SQL and preserve existing constraints and triggers. Apply with `pnpm db:migrate`, generate the client, and run the checks. `db:migrate` invokes `prisma migrate deploy` and does not generate the client. Keep applied migrations unchanged. Production migrations are a separate authorized operation.

## Test database

```sh
export TEST_DATABASE_URL='postgresql://<local-role>:<password>@127.0.0.1:5432/ims_bca_test'
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate
pnpm test
```

The records suite uses the migrated schema. The timetable suite applies migrations to its own generated schema and drops that schema at teardown. The role must be able to create schemas and use the extension. Tests bind local HTTP listeners. Never point either test command at a shared or production database.

## Supabase PostgreSQL, planned

The app uses standard PostgreSQL through Prisma and pg. A Supabase project, deployment configuration, managed auth, and RLS policy setup are outside the current repo. On a disposable Supabase project, use the dashboard's PostgreSQL connection string. Prefer the direct endpoint for migrations. If the machine only has IPv4 and the direct endpoint is unavailable, use the session pooler on port 5432. For the long-running Express process, use direct or session mode as appropriate. Follow the provider's TLS instructions and keep the URL server-side. [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres) · [Supabase Prisma guide](https://supabase.com/docs/guides/database/prisma)

Before adoption, verify database role privileges, extension availability and its schema visibility for the GiST exclusion constraint, migration functions and triggers, schema exposure and grants, SSL verification, connection limits, and end-to-end publication on a disposable project. The repository currently uses one `DATABASE_URL` per process invocation. Run migration and runtime processes with their appropriate URLs. Supabase service-role API keys are unnecessary for this database path. Compatibility has been tested only on local PostgreSQL.

## Troubleshooting

- Missing generated Prisma client: run `pnpm db:generate`.
- 503: check Express `/health`, database reachability, migrations, and the Next.js proxy origin.
- 401 on a write: sign in from the timetable in the same browser tab. Verify the operator exists in API configuration.
- Failed `btree_gist` migration: check installation and role/schema permissions on the intended local database. Keep the exclusion constraint.
- Standalone reference without a schedule: `master-resource.js` is local institutional data and excluded from Git. The live Next.js app only requires the reference HTML and CSS.
