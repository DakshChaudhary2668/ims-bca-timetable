# Business rules

## Enforced now

- An academic year owns weekly slots and semesters. Semester numbers are 1–6. Section names, subject codes and faculty codes are normalized by the API. Faculty identity spans semesters.
- Weekly lecture counts are nonnegative integers. A subject's null-section quota is the uniform default within its semester. A section override replaces the default, including zero. An allocated subject with neither quota blocks validation.
- The current validator counts whole-section periods toward every configured batch. Distinct batches marked as such may run concurrently. Whole-section groups overlap their batches. Unclassified groups are treated conservatively for collisions and cannot be published when scheduled.
- Faculty, room and overlapping group collisions are checked across the academic year. Protected slots are unavailable for teaching. Inactive faculty or a recorded unavailable slot block a save. Unrecorded availability can be drafted, but full validation requires a positive availability record.
- `regularDailyClasses` defaults to three. The weekly validator applies only configured `maxTotalDailyPeriods` and `maxConsecutivePeriods` limits. Consecutiveness uses ordered slots, with a protected break or an unused slot interrupting the sequence. The validator does not enforce exactly three regular classes.
- PL-controlled weekly publication is explicit. A publishing key, current validated revision and successful revalidation are required. Published versions remain immutable.

## Planned substitution rules

Use the approved daily schedule, recorded absence and full slot availability. Substitution must be nonconsecutive with assigned teaching, including other substitutions. Prefer same-subject eligible faculty. Generic classroom coverage is an optional fallback and must be labeled as coverage. If no valid candidate exists, leave the class unresolved. PL approval rechecks the proposal against current state before applying it.

**The total daily teaching limit including substitutions is unresolved. Three regular classes do not imply permission for a fourth period.** Before implementing substitution approval, the PL must confirm the cap and any exceptions. While unset, do not approve a fourth teaching period.

## PL decisions

- Confirm total daily teaching workload including substitutions, how to treat unrecorded availability, and which gaps or protected breaks interrupt substitution adjacency.
- Confirm whether existing batch groups are disjoint, the per-batch quota interpretation, any combined-section teaching rules, and whether regular allocations must match faculty eligibility.
- Confirm room/lab suitability requirements, actual session dates and slot sequence, holiday rules, classroom coverage policy and publication delegation.
- Confirm visibility of academic catalogs and published timetables before sharing the app beyond loopback.
