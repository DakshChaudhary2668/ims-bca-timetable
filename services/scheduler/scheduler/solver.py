"""Deterministic CP-SAT timetable proposal generation."""

from __future__ import annotations

from itertools import combinations
from typing import Any

from ortools.sat.python import cp_model
from pydantic import ValidationError

from .models import Diagnostic, Snapshot
from .validation import QuotaTarget, validate_snapshot


def _response_base(raw: dict[str, Any]) -> dict[str, Any]:
    draft = raw.get("draft") if isinstance(raw.get("draft"), dict) else {}
    return {
        "schemaVersion": raw.get("schemaVersion", 1),
        "requestId": raw.get("requestId", ""),
        "draft": {
            "versionId": draft.get("versionId", ""),
            "revision": draft.get("revision", 0),
        },
    }


def _diagnostic(code: str, message: str, **refs: str | None) -> dict[str, str]:
    return Diagnostic(code=code, message=message, **refs).model_dump(exclude_none=True)


def _overlap(left: Any, right: Any) -> bool:
    return (
        left.weekday == right.weekday
        and left.startsAtMinute < right.endsAtMinute
        and right.startsAtMinute < left.endsAtMinute
    )


def _covers(target: QuotaTarget, allocation: Any, group_map: dict[str, Any]) -> bool:
    group = group_map[allocation.studentGroupId]
    if (
        group.sectionId != target.section_id
        or allocation.subjectId != target.subject_id
    ):
        return False
    return (
        target.group_id is None
        or group.wholeSection is True
        or group.id == target.group_id
    )


def generate_timetable(
    snapshot: dict[str, Any], *, time_limit_seconds: float = 10.0
) -> dict[str, Any]:
    """Return a complete feasible timetable proposal for a contract v1 snapshot."""
    base = _response_base(snapshot if isinstance(snapshot, dict) else {})
    try:
        data = Snapshot.model_validate(snapshot)
    except (ValidationError, TypeError, ValueError) as exc:
        details = exc.errors() if isinstance(exc, ValidationError) else []
        message = "Snapshot does not match the timetable contract."
        if details:
            first = details[0]
            loc = ".".join(str(part) for part in first.get("loc", ()))
            message = f"Invalid field {loc}: {first.get('msg', 'invalid value')}"
        return {
            **base,
            "status": "INVALID_INPUT",
            "placements": [],
            "diagnostics": [_diagnostic("INVALID_INPUT", message)],
        }

    targets, errors = validate_snapshot(data)
    if errors:
        return {
            **base,
            "status": "INVALID_INPUT",
            "placements": [],
            "diagnostics": [error.model_dump(exclude_none=True) for error in errors],
        }

    if not any(target.count for target in targets):
        return {
            **base,
            "status": "INFEASIBLE",
            "placements": [],
            "diagnostics": [
                _diagnostic(
                    "EMPTY",
                    "Node validation requires at least one teaching session.",
                )
            ],
        }

    faculty = {record.id: record for record in data.faculty}
    groups = {record.id: record for record in data.studentGroups}
    slots = {record.id: record for record in data.timeSlots}
    availability = {
        (row.facultyId, row.timeSlotId): row.available
        for row in data.facultyAvailability
    }
    rooms = sorted(data.rooms, key=lambda record: record.id)
    teaching_slots = sorted(
        (slot for slot in data.timeSlots if not slot.protectedBreak),
        key=lambda slot: (slot.weekday, slot.startsAtMinute, slot.id),
    )

    candidates: list[tuple[Any, Any, Any]] = []
    for allocation in sorted(data.allocations, key=lambda record: record.id):
        teacher = faculty[allocation.facultyId]
        valid_slots = [
            slot
            for slot in teaching_slots
            if teacher.active and availability.get((teacher.id, slot.id)) is True
        ]
        for slot in valid_slots:
            for room in rooms:
                candidates.append((allocation, slot, room))

    model = cp_model.CpModel()
    variables = [model.new_bool_var(f"x_{i}") for i in range(len(candidates))]

    # One allocation cannot produce simultaneous records for the same session.
    by_allocation_slot: dict[tuple[str, str], list] = {}
    for index, (allocation, slot, _room) in enumerate(candidates):
        by_allocation_slot.setdefault((allocation.id, slot.id), []).append(
            variables[index]
        )
    for group_vars in by_allocation_slot.values():
        model.add_at_most_one(group_vars)

    # Faculty, room, and overlapping student-group occupancy across the whole year.
    for left_index, right_index in combinations(range(len(candidates)), 2):
        left_allocation, left_slot, left_room = candidates[left_index]
        right_allocation, right_slot, right_room = candidates[right_index]
        if not _overlap(left_slot, right_slot):
            continue
        left_group = groups[left_allocation.studentGroupId]
        right_group = groups[right_allocation.studentGroupId]
        same_group_scope = left_group.sectionId == right_group.sectionId and (
            left_group.id == right_group.id
            or left_group.wholeSection is True
            or right_group.wholeSection is True
        )
        if (
            left_allocation.facultyId == right_allocation.facultyId
            or left_room.id == right_room.id
            or same_group_scope
        ):
            model.add(variables[left_index] + variables[right_index] <= 1)

    target_terms: list[tuple[QuotaTarget, list]] = []
    for target in targets:
        terms = [
            variables[index]
            for index, (allocation, _slot, _room) in enumerate(candidates)
            if _covers(target, allocation, groups)
        ]
        target_terms.append((target, terms))
        model.add(sum(terms) == target.count)

    # Node's complete validator applies maxTotalDailyPeriods and maxConsecutivePeriods.
    daily_vars: dict[tuple[str, int], list] = {}
    faculty_slot_vars: dict[tuple[str, str], list] = {}
    for index, (allocation, slot, _room) in enumerate(candidates):
        key = (allocation.facultyId, slot.weekday)
        daily_vars.setdefault(key, []).append(variables[index])
        faculty_slot_vars.setdefault((allocation.facultyId, slot.id), []).append(
            variables[index]
        )
    if data.academicYear.maxTotalDailyPeriods is not None:
        for daily in daily_vars.values():
            model.add(sum(daily) <= data.academicYear.maxTotalDailyPeriods)
    if data.academicYear.maxConsecutivePeriods is not None:
        slots_by_day: dict[int, list] = {}
        for slot in data.timeSlots:
            slots_by_day.setdefault(slot.weekday, []).append(slot)
        for day_slots in slots_by_day.values():
            ordered = sorted(day_slots, key=lambda slot: (slot.startsAtMinute, slot.id))
            limit = data.academicYear.maxConsecutivePeriods
            for teacher in data.faculty:
                # Every series of limit + 1 adjacent defined slots must contain a free
                # period. Break slots and empty slots therefore interrupt teaching.
                for start in range(max(0, len(ordered) - limit)):
                    window = ordered[start : start + limit + 1]
                    occupied = [
                        variable
                        for slot in window
                        for variable in faculty_slot_vars.get((teacher.id, slot.id), [])
                    ]
                    if occupied:
                        model.add(sum(occupied) <= limit)

    if not candidates and any(target.count for target in targets):
        details = []
        for target, terms in target_terms:
            if target.count and not terms:
                details.append(
                    _diagnostic(
                        "NO_AVAILABLE_SLOT",
                        "No available teacher, slot, and room can serve this group.",
                        subjectId=target.subject_id,
                        studentGroupId=target.group_id,
                    )
                )
        return {
            **base,
            "status": "INFEASIBLE",
            "placements": [],
            "diagnostics": details
            or [
                _diagnostic(
                    "INSUFFICIENT_CAPACITY",
                    "No feasible allocation, slot, and room combinations exist.",
                )
            ],
        }

    # A feasibility-only model has no preference objective. A single worker and seed
    # make CP-SAT's search reproducible without claiming an optimal timetable.
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max(0.001, float(time_limit_seconds))
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 0
    solver.parameters.search_branching = cp_model.FIXED_SEARCH
    status = solver.solve(model)
    if status in (cp_model.FEASIBLE, cp_model.OPTIMAL):
        placements = [
            {
                "allocationId": allocation.id,
                "timeSlotId": slot.id,
                "roomId": room.id,
            }
            for index, (allocation, slot, room) in enumerate(candidates)
            if solver.boolean_value(variables[index])
        ]
        placements.sort(
            key=lambda item: (
                slots[item["timeSlotId"]].weekday,
                slots[item["timeSlotId"]].startsAtMinute,
                item["allocationId"],
                item["roomId"],
            )
        )
        return {
            **base,
            "status": "FEASIBLE",
            "placements": placements,
            "diagnostics": [],
        }
    if status == cp_model.INFEASIBLE:
        diagnostics = []
        candidate_allocation_ids = {
            allocation.id for allocation, _slot, _room in candidates
        }
        for target, terms in target_terms:
            specific_allocations = [
                allocation
                for allocation in data.allocations
                if target.group_id is not None
                and allocation.studentGroupId == target.group_id
                and allocation.subjectId == target.subject_id
            ]
            if (
                target.count
                and target.group_id is not None
                and specific_allocations
                and not any(
                    allocation.id in candidate_allocation_ids
                    for allocation in specific_allocations
                )
            ) or (target.count and not terms):
                diagnostics.append(
                    _diagnostic(
                        "NO_AVAILABLE_SLOT",
                        "The batch allocation has no positively available slot.",
                        subjectId=target.subject_id,
                        studentGroupId=target.group_id,
                    )
                )
        if not diagnostics:
            diagnostics.append(
                _diagnostic(
                    "UNSATISFIED_QUOTA",
                    "Weekly quotas exceed available capacity.",
                )
            )
        return {
            **base,
            "status": "INFEASIBLE",
            "placements": [],
            "diagnostics": diagnostics,
        }
    return {
        **base,
        "status": "UNKNOWN",
        "placements": [],
        "diagnostics": [
            _diagnostic(
                "SOLVER_TIMEOUT",
                "No complete timetable or proof was found before the time limit.",
            )
        ],
    }
