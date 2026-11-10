# Working in IMS BCA Timetable

- Daksh owns integration, API, database migrations and cross-module decisions. Harry owns the future Python solver under `services/scheduler`. Priyanshu owns UI and implementation support under `apps/web`. Coordinate changes to contracts, Prisma, lockfiles and shared styles.
- Preserve the timetable markup and appearance. The home route uses the imported HTML/CSS with `apps/web/timetable/client.js`. Keep the standalone reference separate. Academic record screens use Next.js components.
- Express owns authorization, business validation and writes. Validate every request at the boundary with Zod. Reuse the Prisma client and PostgreSQL. The browser and Python solver must never write directly to the database.
- Use strict TypeScript and existing ESM conventions. The API uses explicit `.js` specifiers in TypeScript imports. Keep types narrow and errors structured. Keep the existing browser JavaScript style for the timetable.
- For future Python code use typed, versioned JSON contracts, explicit solver statuses, reproducible synthetic tests and bounded solver runs. No runtime Python package exists yet.
- Use small tests for behavior changes, especially stale revisions, authorization, conflicts, quotas and immutable history. Run lint, typecheck, build, format verification and database tests against disposable local data.
- Add migrations in order. Review custom SQL, extension requirements and data effects. Never edit an applied migration, reset a shared database, run a production migration, or seed with institutional records without explicit authorization.
- The solver proposes drafts only. Publication requires the Programme Leader or an explicitly approved publisher, the current revision, and server revalidation. Substitution policy belongs in Node.js. Never infer permission for a fourth teaching period.
- Keep work on `main`. No feature or develop branches, automatic commits, pushes, force pushes, or deployments. No new services, CI or dependencies without a concrete need.
