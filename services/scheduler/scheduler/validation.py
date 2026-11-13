"""Cross-record validation and quota resolution for contract v1."""

from collections import Counter
from dataclasses import dataclass

from .models import Diagnostic, Snapshot


@dataclass(frozen=True)
class QuotaTarget:
    section_id: str
    semester_id: str
    subject_id: str
    group_id: str | None
    count: int


def _diagnostic(code: str, message: str, **refs: str | None) -> Diagnostic:
    return Diagnostic(code=code, message=message, **refs)


def resolve_quotas(snapshot: Snapshot) -> tuple[list[QuotaTarget], list[Diagnostic]]:
    """Return one quota target per batch, or per section when there are no batches."""
    errors: list[Diagnostic] = []
    semester_by_id = {item.id: item for item in snapshot.semesters}
    section_by_id = {item.id: item for item in snapshot.sections}
    subject_by_id = {item.id: item for item in snapshot.subjects}
    groups_by_section: dict[str, list] = {}
    for group in snapshot.studentGroups:
        groups_by_section.setdefault(group.sectionId, []).append(group)

    requirement_map: dict[tuple[str, str | None], int] = {}
    duplicate_rows = Counter(
        (row.subjectId, row.sectionId) for row in snapshot.weeklyRequirements
    )
    for row in snapshot.weeklyRequirements:
        key = (row.subjectId, row.sectionId)
        if duplicate_rows[key] > 1:
            errors.append(
                _diagnostic(
                    "DUPLICATE_QUOTA",
                    "Only one weekly requirement may exist for a subject and scope.",
                    subjectId=row.subjectId,
                )
            )
        requirement_map[key] = row.lectureCount

    for allocation in snapshot.allocations:
        group = next(
            (g for g in snapshot.studentGroups if g.id == allocation.studentGroupId),
            None,
        )
        if group is None:
            continue
        if group.wholeSection is None:
            errors.append(
                _diagnostic(
                    "UNRESOLVED_GROUP_SCOPE",
                    f"Teaching group {group.name} has no confirmed scope.",
                    allocationId=allocation.id,
                    studentGroupId=group.id,
                )
            )

    targets: list[QuotaTarget] = []
    allocated_subjects: set[tuple[str, str]] = set()
    for allocation in snapshot.allocations:
        group = next(
            (g for g in snapshot.studentGroups if g.id == allocation.studentGroupId),
            None,
        )
        if group:
            allocated_subjects.add((group.sectionId, allocation.subjectId))

    scoped_subjects = set(allocated_subjects)
    for section in snapshot.sections:
        for subject in snapshot.subjects:
            if subject.semesterId != section.semesterId:
                continue
            if (subject.id, section.id) in requirement_map or (
                subject.id,
                None,
            ) in requirement_map:
                scoped_subjects.add((section.id, subject.id))

    for section_id, subject_id in sorted(scoped_subjects):
        section = section_by_id.get(section_id)
        subject = subject_by_id.get(subject_id)
        if not section or not subject:
            continue
        semester = semester_by_id.get(section.semesterId)
        if not semester:
            continue
        quota = requirement_map.get((subject_id, section_id))
        if quota is None:
            quota = requirement_map.get((subject_id, None))
        if quota is None:
            if (section_id, subject_id) in allocated_subjects:
                errors.append(
                    _diagnostic(
                        "MISSING_QUOTA",
                        f"Configure a weekly requirement for {subject.code}.",
                        subjectId=subject_id,
                    )
                )
            continue

        batches = sorted(
            (
                g
                for g in groups_by_section.get(section_id, [])
                if g.wholeSection is False
            ),
            key=lambda group: group.id,
        )
        scopes: list[str | None] = [g.id for g in batches] if batches else [None]
        for group_id in scopes:
            covering = [
                allocation
                for allocation in snapshot.allocations
                if allocation.subjectId == subject_id
                and allocation.studentGroupId
                in (
                    {group_id}
                    if group_id is not None
                    else {
                        group.id
                        for group in groups_by_section.get(section_id, [])
                        if group.wholeSection is True
                    }
                )
            ]
            if group_id is not None:
                covering.extend(
                    allocation
                    for allocation in snapshot.allocations
                    if allocation.subjectId == subject_id
                    and allocation.studentGroupId
                    == next(
                        (
                            g.id
                            for g in groups_by_section.get(section_id, [])
                            if g.wholeSection is True
                        ),
                        None,
                    )
                )
            elif not covering:
                # A section without batches may still be represented by its sole
                # explicitly scoped teaching group.
                covering = [
                    allocation
                    for allocation in snapshot.allocations
                    if allocation.subjectId == subject_id
                    and allocation.studentGroupId
                    in {g.id for g in groups_by_section.get(section_id, [])}
                ]
            if quota > 0 and not covering:
                errors.append(
                    _diagnostic(
                        "MISSING_ALLOCATION",
                        "No teaching allocation can deliver this group's quota.",
                        subjectId=subject_id,
                        studentGroupId=group_id,
                    )
                )
            targets.append(
                QuotaTarget(section_id, semester.id, subject_id, group_id, quota)
            )
    return targets, errors


def validate_snapshot(snapshot: Snapshot) -> tuple[list[QuotaTarget], list[Diagnostic]]:
    errors: list[Diagnostic] = []
    if snapshot.schemaVersion != 1:
        errors.append(
            _diagnostic("UNSUPPORTED_SCHEMA", "Only schemaVersion 1 is supported.")
        )

    id_arrays = (
        ("semester", snapshot.semesters),
        ("section", snapshot.sections),
        ("student group", snapshot.studentGroups),
        ("subject", snapshot.subjects),
        ("faculty", snapshot.faculty),
        ("allocation", snapshot.allocations),
        ("room", snapshot.rooms),
        ("time slot", snapshot.timeSlots),
    )
    for label, records in id_arrays:
        if len({record.id for record in records}) != len(records):
            errors.append(
                _diagnostic("DUPLICATE_ID", f"Duplicate {label} IDs are not allowed.")
            )

    year_id = snapshot.academicYear.id
    semester_map = {item.id: item for item in snapshot.semesters}
    section_map = {item.id: item for item in snapshot.sections}
    group_map = {item.id: item for item in snapshot.studentGroups}
    subject_map = {item.id: item for item in snapshot.subjects}
    faculty_map = {item.id: item for item in snapshot.faculty}
    slot_map = {item.id: item for item in snapshot.timeSlots}
    room_ids = {item.id for item in snapshot.rooms}

    for semester in snapshot.semesters:
        if semester.academicYearId != year_id:
            errors.append(
                _diagnostic(
                    "UNKNOWN_SEMESTER_SCOPE",
                    "Semester is outside the selected academic year.",
                )
            )
    for section in snapshot.sections:
        semester = semester_map.get(section.semesterId)
        if semester is None or semester.academicYearId != year_id:
            errors.append(
                _diagnostic(
                    "UNKNOWN_SECTION_SEMESTER",
                    "Section references an unknown or out-of-scope semester.",
                )
            )
    for group in snapshot.studentGroups:
        section = section_map.get(group.sectionId)
        if section is None or section.semesterId != group.semesterId:
            errors.append(
                _diagnostic(
                    "UNKNOWN_GROUP_REFERENCE",
                    "Student group has inconsistent section or semester references.",
                    studentGroupId=group.id,
                )
            )
    for subject in snapshot.subjects:
        if subject.semesterId not in semester_map:
            errors.append(
                _diagnostic(
                    "UNKNOWN_SUBJECT_SEMESTER",
                    "Subject references an unknown semester.",
                    subjectId=subject.id,
                )
            )
    for row in snapshot.weeklyRequirements:
        subject = subject_map.get(row.subjectId)
        section = section_map.get(row.sectionId) if row.sectionId else None
        if subject is None or subject.semesterId != row.semesterId:
            errors.append(
                _diagnostic(
                    "UNKNOWN_QUOTA_SUBJECT",
                    "Weekly requirement references an unknown or inconsistent subject.",
                    subjectId=row.subjectId,
                )
            )
        if row.sectionId and (section is None or section.semesterId != row.semesterId):
            errors.append(
                _diagnostic(
                    "UNKNOWN_QUOTA_SECTION",
                    "Weekly requirement references an unknown or inconsistent section.",
                    subjectId=row.subjectId,
                )
            )
    for allocation in snapshot.allocations:
        group = group_map.get(allocation.studentGroupId)
        subject = subject_map.get(allocation.subjectId)
        if allocation.facultyId not in faculty_map:
            errors.append(
                _diagnostic(
                    "UNKNOWN_FACULTY",
                    "Allocation references an unknown faculty member.",
                    allocationId=allocation.id,
                )
            )
        if (
            group is None
            or subject is None
            or group.semesterId != allocation.semesterId
            or subject.semesterId != allocation.semesterId
        ):
            errors.append(
                _diagnostic(
                    "UNKNOWN_ALLOCATION_REFERENCE",
                    "Allocation subject, group, or semester reference is inconsistent.",
                    allocationId=allocation.id,
                )
            )
    for slot in snapshot.timeSlots:
        if slot.academicYearId != year_id:
            errors.append(
                _diagnostic(
                    "UNKNOWN_SLOT_SCOPE",
                    "Time slot is outside the selected academic year.",
                    timeSlotId=slot.id,
                )
            )
        if slot.startsAtMinute >= slot.endsAtMinute:
            errors.append(
                _diagnostic(
                    "INVALID_TIME_RANGE",
                    "Time slots must have a positive half-open minute interval.",
                    timeSlotId=slot.id,
                )
            )
    for day in range(1, 8):
        day_slots = sorted(
            (s for s in snapshot.timeSlots if s.weekday == day),
            key=lambda s: (s.startsAtMinute, s.endsAtMinute, s.id),
        )
        for left, right in zip(day_slots, day_slots[1:], strict=False):
            if left.endsAtMinute > right.startsAtMinute:
                errors.append(
                    _diagnostic(
                        "OVERLAPPING_TIME_SLOTS",
                        "Time slots on the same weekday must not overlap.",
                        timeSlotId=right.id,
                    )
                )
    seen_availability: set[tuple[str, str]] = set()
    for row in snapshot.facultyAvailability:
        pair = (row.facultyId, row.timeSlotId)
        if row.facultyId not in faculty_map or row.timeSlotId not in slot_map:
            errors.append(
                _diagnostic(
                    "UNKNOWN_AVAILABILITY_REFERENCE",
                    "Availability references an unknown faculty member or time slot.",
                    timeSlotId=row.timeSlotId,
                )
            )
        if pair in seen_availability:
            errors.append(
                _diagnostic(
                    "DUPLICATE_AVAILABILITY",
                    "Faculty availability contains a duplicate faculty and slot pair.",
                    timeSlotId=row.timeSlotId,
                )
            )
        seen_availability.add(pair)
    if not room_ids and snapshot.allocations:
        errors.append(
            _diagnostic(
                "INSUFFICIENT_ROOMS",
                "No rooms are supplied for the teaching allocations.",
            )
        )

    targets, quota_errors = resolve_quotas(snapshot)
    errors.extend(quota_errors)
    return targets, errors
