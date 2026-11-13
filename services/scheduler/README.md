# Python timetable scheduler

This package implements the version 1, pure input-to-output proposal engine from [`docs/TIMETABLE_ENGINE.md`](../../docs/TIMETABLE_ENGINE.md). It proposes a complete recurring weekly draft with OR-Tools CP-SAT. It has no database connection, API server, publication capability, or institutional data dependency.

## Setup and local use

Use Python 3.12 and a virtual environment:

```sh
cd services/scheduler
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[dev]'
pytest
python -m scheduler.cli tests/fixtures/feasible.json
python -m scheduler.cli tests/fixtures/infeasible.json --output /tmp/infeasible-result.json
```

The CLI returns exit code 0 for a complete proposal and 1 for `INFEASIBLE`, `INVALID_INPUT`, or `UNKNOWN`. `--time-limit` sets the bounded CP-SAT run in seconds. The function API is:

```python
from scheduler import generate_timetable

proposal = generate_timetable(snapshot)
```

## Supported rules

- Strict Pydantic validation for the versioned input shape and cross-record references.
- Exact weekly subject quotas, with section override precedence including an explicit zero.
- Whole-section teaching counted for each configured batch; disjoint batches may run in parallel.
- Faculty, room, and student group collision prevention across all selected semesters in the academic year.
- Positive explicit faculty availability only; inactive faculty and protected breaks are excluded.
- Configured `maxTotalDailyPeriods` and `maxConsecutivePeriods`, using the Node validator's ordered slot sequence. `regularDailyClasses` is not an additional solver cap because the current validator does not apply it to weekly schedules.
- Stable input ordering, CP-SAT seed 0, one search worker, and deterministic output ordering where practical.

An explicit zero quota is honored. If every effective quota is zero, the engine returns `INFEASIBLE` with `EMPTY`, because the current Node validator rejects proposals with no teaching sessions.

## Status and diagnostics

`FEASIBLE` means a complete valid placement set was found. There is no soft objective, so the engine does not claim an optimal or unique timetable. `INFEASIBLE` is returned only when CP-SAT proves infeasibility. Missing or inconsistent data returns `INVALID_INPUT`. A time limit without a proof or full solution returns `UNKNOWN`, never `INFEASIBLE`.

The solver emits placements only from supplied allocation, room, and slot IDs. It never emits partial proposals. Infeasibility diagnostics explain a detected prerequisite or the unsatisfied weekly requirements; they are not a minimal conflict set.

## Boundaries and remaining policy

- Shared sessions across multiple sections are not modeled. Coordinate a contract extension with Daksh before adding this concept.
- `Room` has no capacity, equipment, suitability, availability, lab, or travel attributes. The solver cannot enforce those policies and does not infer them from room names.
- Multi-period practical requirements are not represented by contract v1's single-period quota. Full practical scheduling needs a contract extension specifying duration and consecutive slot semantics.
- Existing draft placements are not locked or optimized for stability. The result is a complete replacement proposal for the supplied revision.
- No preferences or soft objective are implemented. The PL must confirm preferences before optimization is added.
- The package has not been benchmarked on a production-sized academic year. The default limit is 10 seconds; tune it only with measured synthetic snapshots.
- Express currently has no solver transport or proposal-apply endpoint. The Python result is not persisted, validated by Node from this package, or publishable by itself.

See [`docs/DEVELOPER_HANDOVER.md`](../../docs/DEVELOPER_HANDOVER.md) for the exact future integration sequence and [`docs/IMPLEMENTATION_STATUS.md`](../../docs/IMPLEMENTATION_STATUS.md) for verification results.
