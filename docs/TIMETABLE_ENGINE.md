# Timetable engine handoff for Harry

**Contract v1 implemented in `services/scheduler`.** The Python core uses Google OR-Tools CP-SAT and takes a versioned snapshot to return a proposed **draft**. Express still owns the data, revision check, validation, persistence and explicit publication. See the [scheduler setup and supported rules](../services/scheduler/README.md).

## Problem and actual inputs

Schedule one recurring teaching week for an academic year across its semesters, so shared faculty and rooms cannot be double-booked. Use the hierarchy AcademicYear → Semester → Section → StudentGroup and the existing TeachingAllocation tuple (faculty, subject and teaching group in the same semester). Resolve weekly requirements as a section override, including zero, followed by the subject default. Report missing quotas for allocated subjects as input errors. Eligibility is a separate catalog relation and is not currently mandatory for regular allocations.

A whole-section placement counts toward each configured batch's quota. For explicitly disjoint batches, parallel placements are allowed when faculty and rooms differ. Treat an unclassified group as unresolved rather than inferring scope from its name. There is no shared-session entity for combining multiple sections in a single placement. Ask the PL before adding one.

Slots use ISO weekdays and half-open minute ranges in local campus time. The database forbids overlapping intervals in the same year and weekday. Exclude protected breaks. Use active faculty with explicit positive availability for each chosen slot to produce a proposal that can pass full validation. `Room` currently contains only an ID and name. Capacity, equipment, lab-only subjects, room availability and travel are not modeled. Do not infer lab eligibility from names. If lab requirements are mandatory for a run, report the missing policy/data instead of claiming compliance.

## Constraints

Use a binary decision for each feasible allocation/slot/room triple. Pre-filter invalid references, unavailable faculty and protected breaks. Enforce:

- At most one simultaneous placement per faculty and per room across the year.
- No overlap for the same batch or between a whole-section placement and any batch in that section.
- Exact effective weekly quotas for each section and, where configured, each batch. One whole-section placement satisfies one period for each batch.
- Explicitly configured daily and consecutive limits. Follow the current validator's ordered slot semantics. A protected break or a slot without a class for that faculty member interrupts a run.
- Existing assignments stay intact until the PL reviews and explicitly applies a proposal. The first solver can propose a complete replacement for a specific draft revision without modeling locks.

Start with feasibility. Candidate soft objectives for PL confirmation are fewer idle gaps and changes from the current draft, balanced days, and stable room use. Keep those preferences separate from hard constraints. Do not interpret the default three regular classes as a confirmed total including substitutions.

## Proposed contract v1

Node supplies a consistent snapshot. Contract arrays are projections of current models. UUIDs are illustrative synthetic records. Omitted database metadata is supplied by Node when persisting. The example has one shared period and a second period taught in parallel to two disjoint batches. Each batch receives two periods.

### Input

```json
{
  "schemaVersion": 1,
  "requestId": "demo-run-01",
  "draft": {
    "versionId": "00000000-0000-4000-8000-000000000018",
    "revision": 2
  },
  "academicYear": {
    "id": "00000000-0000-4000-8000-000000000001",
    "name": "Demo academic year",
    "startsOn": "2026-07-01",
    "endsOn": "2027-06-30",
    "regularDailyClasses": 3,
    "maxTotalDailyPeriods": null,
    "maxConsecutivePeriods": null
  },
  "semesters": [
    {
      "id": "00000000-0000-4000-8000-000000000002",
      "academicYearId": "00000000-0000-4000-8000-000000000001",
      "number": 3
    }
  ],
  "sections": [
    {
      "id": "00000000-0000-4000-8000-000000000003",
      "semesterId": "00000000-0000-4000-8000-000000000002",
      "name": "A"
    }
  ],
  "studentGroups": [
    {
      "id": "00000000-0000-4000-8000-000000000004",
      "sectionId": "00000000-0000-4000-8000-000000000003",
      "semesterId": "00000000-0000-4000-8000-000000000002",
      "name": "Whole section",
      "wholeSection": true
    },
    {
      "id": "00000000-0000-4000-8000-000000000005",
      "sectionId": "00000000-0000-4000-8000-000000000003",
      "semesterId": "00000000-0000-4000-8000-000000000002",
      "name": "Batch 1",
      "wholeSection": false
    },
    {
      "id": "00000000-0000-4000-8000-000000000006",
      "sectionId": "00000000-0000-4000-8000-000000000003",
      "semesterId": "00000000-0000-4000-8000-000000000002",
      "name": "Batch 2",
      "wholeSection": false
    }
  ],
  "subjects": [
    {
      "id": "00000000-0000-4000-8000-000000000007",
      "semesterId": "00000000-0000-4000-8000-000000000002",
      "code": "DEMO-DB",
      "name": "Demo databases"
    }
  ],
  "weeklyRequirements": [
    {
      "subjectId": "00000000-0000-4000-8000-000000000007",
      "semesterId": "00000000-0000-4000-8000-000000000002",
      "sectionId": null,
      "lectureCount": 2
    }
  ],
  "faculty": [
    {
      "id": "00000000-0000-4000-8000-000000000008",
      "facultyCode": "DEMO-A",
      "name": "Demo Instructor A",
      "active": true
    },
    {
      "id": "00000000-0000-4000-8000-000000000009",
      "facultyCode": "DEMO-B",
      "name": "Demo Instructor B",
      "active": true
    }
  ],
  "allocations": [
    {
      "id": "00000000-0000-4000-8000-000000000015",
      "facultyId": "00000000-0000-4000-8000-000000000008",
      "subjectId": "00000000-0000-4000-8000-000000000007",
      "semesterId": "00000000-0000-4000-8000-000000000002",
      "studentGroupId": "00000000-0000-4000-8000-000000000004"
    },
    {
      "id": "00000000-0000-4000-8000-000000000016",
      "facultyId": "00000000-0000-4000-8000-000000000008",
      "subjectId": "00000000-0000-4000-8000-000000000007",
      "semesterId": "00000000-0000-4000-8000-000000000002",
      "studentGroupId": "00000000-0000-4000-8000-000000000005"
    },
    {
      "id": "00000000-0000-4000-8000-000000000017",
      "facultyId": "00000000-0000-4000-8000-000000000009",
      "subjectId": "00000000-0000-4000-8000-000000000007",
      "semesterId": "00000000-0000-4000-8000-000000000002",
      "studentGroupId": "00000000-0000-4000-8000-000000000006"
    }
  ],
  "rooms": [
    {
      "id": "00000000-0000-4000-8000-000000000010",
      "name": "Demo Room A"
    },
    {
      "id": "00000000-0000-4000-8000-000000000011",
      "name": "Demo Room B"
    }
  ],
  "timeSlots": [
    {
      "id": "00000000-0000-4000-8000-000000000012",
      "academicYearId": "00000000-0000-4000-8000-000000000001",
      "weekday": 1,
      "startsAtMinute": 540,
      "endsAtMinute": 600,
      "protectedBreak": false
    },
    {
      "id": "00000000-0000-4000-8000-000000000014",
      "academicYearId": "00000000-0000-4000-8000-000000000001",
      "weekday": 1,
      "startsAtMinute": 600,
      "endsAtMinute": 660,
      "protectedBreak": true
    },
    {
      "id": "00000000-0000-4000-8000-000000000013",
      "academicYearId": "00000000-0000-4000-8000-000000000001",
      "weekday": 1,
      "startsAtMinute": 660,
      "endsAtMinute": 720,
      "protectedBreak": false
    }
  ],
  "facultyAvailability": [
    {
      "facultyId": "00000000-0000-4000-8000-000000000008",
      "timeSlotId": "00000000-0000-4000-8000-000000000012",
      "available": true
    },
    {
      "facultyId": "00000000-0000-4000-8000-000000000008",
      "timeSlotId": "00000000-0000-4000-8000-000000000013",
      "available": true
    },
    {
      "facultyId": "00000000-0000-4000-8000-000000000009",
      "timeSlotId": "00000000-0000-4000-8000-000000000013",
      "available": true
    }
  ]
}
```

### Feasible output

```json
{
  "schemaVersion": 1,
  "requestId": "demo-run-01",
  "draft": {
    "versionId": "00000000-0000-4000-8000-000000000018",
    "revision": 2
  },
  "status": "FEASIBLE",
  "placements": [
    {
      "allocationId": "00000000-0000-4000-8000-000000000015",
      "timeSlotId": "00000000-0000-4000-8000-000000000012",
      "roomId": "00000000-0000-4000-8000-000000000010"
    },
    {
      "allocationId": "00000000-0000-4000-8000-000000000016",
      "timeSlotId": "00000000-0000-4000-8000-000000000013",
      "roomId": "00000000-0000-4000-8000-000000000010"
    },
    {
      "allocationId": "00000000-0000-4000-8000-000000000017",
      "timeSlotId": "00000000-0000-4000-8000-000000000013",
      "roomId": "00000000-0000-4000-8000-000000000011"
    }
  ],
  "diagnostics": []
}
```

### Infeasible output

For the infeasible fixture, Demo Instructor B has no positive availability, and Demo Instructor A is marked unavailable in the later teaching slot. The contract says a whole-section placement counts toward each batch, so removing only Instructor B's availability would still allow the whole-section allocation to satisfy both batches' quota. This fixture removes that alternative as well.

```json
{
  "schemaVersion": 1,
  "requestId": "demo-run-02",
  "draft": {
    "versionId": "00000000-0000-4000-8000-000000000018",
    "revision": 2
  },
  "status": "INFEASIBLE",
  "placements": [],
  "diagnostics": [
    {
      "code": "NO_AVAILABLE_SLOT",
      "message": "The batch allocation has no positively available slot.",
      "subjectId": "00000000-0000-4000-8000-000000000007",
      "studentGroupId": "00000000-0000-4000-8000-000000000006"
    }
  ]
}
```

Use `FEASIBLE` or `OPTIMAL` only for a complete solution. Use `INVALID_INPUT` for missing or inconsistent prerequisites and `UNKNOWN` for a run that ends without proving feasibility or infeasibility. A time limit alone does not prove infeasibility. Return stable IDs and a short explanation for actionable diagnostics. A diagnosis need not be a minimal conflict set.

## Draft generation workflow

1. Node checks authorization and snapshots the year and target draft revision. A future handler will invoke the solver with a time limit. No handler exists today.
2. Python validates input, solves, and returns placements or diagnostics. It does not access the database.
3. Node validates every returned ID, collision and quota. The user reviews the proposal. A future apply command checks the draft revision and current catalog in a transaction, saves the proposal as DRAFT, and increments the revision. The current public API saves one session at a time.
4. Use the existing explicit validation and PL-controlled publication flow. A feasible solver result never publishes or overrides a newer revision.

## Current implementation notes

The Python function and CLI implement the contract above without changing its identifiers or quota meaning. Run the `feasible.json` and `infeasible.json` fixtures and the pytest suite using the commands in the scheduler README. The solver uses a feasibility-only model, one CP-SAT worker and a fixed seed. It returns `FEASIBLE` for a complete proposal, `INFEASIBLE` only after a proof, `INVALID_INPUT` for invalid prerequisites, and `UNKNOWN` when a time limit ends without a complete answer. It does not claim an optimal or unique timetable.

An explicit zero quota is honored alongside other required teaching. When all effective quotas are zero, the solver reports `INFEASIBLE` with an `EMPTY` diagnostic because the current Node validator requires at least one session. Confirm whether that empty-draft policy should change before adding generation integration.

The current Prisma `Room` model cannot express capacity, equipment, room suitability, availability, or travel; contract v1 cannot express cross-section shared teaching or consecutive multi-period practicals. Those remain unsupported and require agreement with Daksh before contract or schema changes. Current solver performance has not been benchmarked on a production-sized year. The Node API has no solver transport or bulk apply endpoint, so integration must validate every returned proposal using the existing validator before a human applies it.

The pure synthetic fixture tests cover the example above and infeasible quota cases. Add the integration route only after reviewing the versioned contract with Daksh.
