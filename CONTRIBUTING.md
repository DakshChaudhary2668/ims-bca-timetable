# Contributing

Clone the approved repository when Daksh supplies its URL. Follow the [setup guide](docs/SETUP_GUIDE.md) with local synthetic records. Work on `main` only.

1. Check `git status --short --branch` and coordinate changes with the other owners before editing shared files.
2. With a clean tree, run `git pull --ff-only origin main`. If the histories diverge, coordinate with Daksh before reconciling. Preserve both contributors' changes. Never force-push or reset away another person's work.
3. Keep commits focused. Use imperative subjects such as `docs: explain solver draft contract` or `fix: reject stale timetable edits`.
4. Run `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm format:check` and the local [integration tests](docs/SETUP_GUIDE.md#test-database). Review the staged diff and filenames. Commit and push manually only after approval and an up-to-date pre-push audit.

Coordinate `schema.prisma`, migration ordering, API shapes, timetable markup, shared CSS and `pnpm-lock.yaml` with Daksh. For merge conflicts in those files, agree on the intended contract or migration order before regenerating anything.

Exclude local env files, operator keys, database URLs containing real credentials, backups, exports, workbooks, personal records and generated artifacts. Use synthetic names and IDs in fixtures and examples. Keep the workbook-derived legacy data private. An ignore rule cannot remove an already tracked file or erase history.
