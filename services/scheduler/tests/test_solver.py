import json
from pathlib import Path
from types import SimpleNamespace

from ortools.sat.python import cp_model

import scheduler.solver as solver_module
from scheduler import generate_timetable

FIXTURES = Path(__file__).parent / "fixtures"


def fixture() -> dict:
    return json.loads((FIXTURES / "feasible.json").read_text(encoding="utf-8"))


def test_protected_breaks_are_never_scheduled_and_batch_parallelism_is_supported() -> (
    None
):
    snapshot = fixture()
    result = generate_timetable(snapshot)
    assert result["status"] == "FEASIBLE"
    breaks = {slot["id"] for slot in snapshot["timeSlots"] if slot["protectedBreak"]}
    assert not any(item["timeSlotId"] in breaks for item in result["placements"])
    batches = {
        group["id"]
        for group in snapshot["studentGroups"]
        if group["wholeSection"] is False
    }
    parallel = {}
    for item in result["placements"]:
        allocation = next(
            row for row in snapshot["allocations"] if row["id"] == item["allocationId"]
        )
        if allocation["studentGroupId"] in batches:
            parallel.setdefault(item["timeSlotId"], set()).add(
                allocation["studentGroupId"]
            )
    assert any(len(groups) == 2 for groups in parallel.values())


def test_section_and_batch_requirements_are_counted_by_group_not_allocation_count() -> (
    None
):
    snapshot = fixture()
    result = generate_timetable(snapshot)
    assert result["status"] == "FEASIBLE"
    counts = {group["id"]: 0 for group in snapshot["studentGroups"]}
    for item in result["placements"]:
        allocation = next(
            row for row in snapshot["allocations"] if row["id"] == item["allocationId"]
        )
        group = next(
            row
            for row in snapshot["studentGroups"]
            if row["id"] == allocation["studentGroupId"]
        )
        if group["wholeSection"]:
            for batch in snapshot["studentGroups"]:
                if (
                    batch["sectionId"] == group["sectionId"]
                    and batch["wholeSection"] is False
                ):
                    counts[batch["id"]] += 1
        else:
            counts[group["id"]] += 1
    assert counts["00000000-0000-4000-8000-000000000005"] == 2
    assert counts["00000000-0000-4000-8000-000000000006"] == 2


def test_explicit_zero_quota_is_valid_and_respected() -> None:
    snapshot = fixture()
    zero_subject = "00000000-0000-4000-8000-000000000020"
    zero_allocation = "00000000-0000-4000-8000-000000000021"
    batch = snapshot["studentGroups"][1]
    faculty = snapshot["faculty"][1]
    snapshot["subjects"].append(
        {
            "id": zero_subject,
            "semesterId": batch["semesterId"],
            "code": "ZERO",
            "name": "Zero quota",
        }
    )
    snapshot["weeklyRequirements"].append(
        {
            "subjectId": zero_subject,
            "semesterId": batch["semesterId"],
            "sectionId": batch["sectionId"],
            "lectureCount": 0,
        }
    )
    snapshot["allocations"].append(
        {
            "id": zero_allocation,
            "facultyId": faculty["id"],
            "subjectId": zero_subject,
            "semesterId": batch["semesterId"],
            "studentGroupId": batch["id"],
        }
    )
    result = generate_timetable(snapshot)
    assert result["status"] == "FEASIBLE"
    assert zero_allocation not in {
        item["allocationId"] for item in result["placements"]
    }


def test_all_zero_quotas_do_not_create_node_rejected_empty_proposal() -> None:
    snapshot = fixture()
    snapshot["weeklyRequirements"][0]["lectureCount"] = 0
    result = generate_timetable(snapshot)
    assert result["status"] == "INFEASIBLE"
    assert result["placements"] == []
    assert result["diagnostics"][0]["code"] == "EMPTY"


def test_missing_positive_availability_excludes_allocation() -> None:
    snapshot = fixture()
    snapshot["facultyAvailability"] = [
        row
        for row in snapshot["facultyAvailability"]
        if row["facultyId"] != snapshot["faculty"][1]["id"]
        and not (
            row["facultyId"] == snapshot["faculty"][0]["id"]
            and row["timeSlotId"] == snapshot["timeSlots"][2]["id"]
        )
    ]
    result = generate_timetable(snapshot)
    assert result["status"] == "INFEASIBLE"
    assert result["placements"] == []


def test_whole_section_and_batch_sessions_cannot_overlap() -> None:
    snapshot = fixture()
    snapshot["allocations"] = snapshot["allocations"][:1]
    snapshot["weeklyRequirements"][0]["lectureCount"] = 1
    first_slot = snapshot["timeSlots"][0]
    snapshot["timeSlots"] = [first_slot]
    faculty_c = {
        "id": "00000000-0000-4000-8000-000000000041",
        "facultyCode": "DEMO-C",
        "name": "Demo Instructor C",
        "active": True,
    }
    snapshot["faculty"].append(faculty_c)
    second_subject = "00000000-0000-4000-8000-000000000042"
    snapshot["subjects"].append(
        {
            "id": second_subject,
            "semesterId": snapshot["semesters"][0]["id"],
            "code": "DEMO-ALT",
            "name": "Demo alternative",
        }
    )
    snapshot["weeklyRequirements"].append(
        {
            "subjectId": second_subject,
            "semesterId": snapshot["semesters"][0]["id"],
            "sectionId": None,
            "lectureCount": 1,
        }
    )
    for index, batch in enumerate(snapshot["studentGroups"][1:]):
        snapshot["allocations"].append(
            {
                "id": f"00000000-0000-4000-8000-00000000004{index + 3}",
                "facultyId": snapshot["faculty"][index + 1]["id"]
                if index == 0
                else faculty_c["id"],
                "subjectId": second_subject,
                "semesterId": snapshot["semesters"][0]["id"],
                "studentGroupId": batch["id"],
            }
        )
    snapshot["rooms"].append(
        {"id": "00000000-0000-4000-8000-000000000050", "name": "Demo Room C"}
    )
    snapshot["facultyAvailability"] = [
        {
            "facultyId": person["id"],
            "timeSlotId": first_slot["id"],
            "available": True,
        }
        for person in snapshot["faculty"]
    ]
    result = generate_timetable(snapshot)
    assert result["status"] == "INFEASIBLE"


def test_room_identity_is_id_and_same_room_cannot_host_parallel_batches() -> None:
    snapshot = fixture()
    snapshot["studentGroups"] = snapshot["studentGroups"][1:]
    snapshot["allocations"] = snapshot["allocations"][1:]
    snapshot["weeklyRequirements"][0]["lectureCount"] = 1
    snapshot["timeSlots"] = [snapshot["timeSlots"][0]]
    snapshot["rooms"] = [
        snapshot["rooms"][0],
        {**snapshot["rooms"][1], "name": snapshot["rooms"][0]["name"]},
    ]
    first_slot = snapshot["timeSlots"][0]["id"]
    snapshot["facultyAvailability"] = [
        {
            "facultyId": snapshot["faculty"][0]["id"],
            "timeSlotId": first_slot,
            "available": True,
        },
        {
            "facultyId": snapshot["faculty"][1]["id"],
            "timeSlotId": first_slot,
            "available": True,
        },
    ]
    result = generate_timetable(snapshot)
    assert result["status"] == "FEASIBLE"
    assert len(result["placements"]) == 2
    # Duplicate names do not collapse room identity; both IDs remain usable.
    assert len({item["roomId"] for item in result["placements"]}) == 2


def test_room_collision_prevents_parallel_sessions_in_one_room() -> None:
    snapshot = fixture()
    snapshot["studentGroups"] = snapshot["studentGroups"][1:]
    snapshot["allocations"] = snapshot["allocations"][1:]
    snapshot["weeklyRequirements"][0]["lectureCount"] = 1
    first_slot = snapshot["timeSlots"][0]
    snapshot["timeSlots"] = [first_slot]
    snapshot["rooms"] = snapshot["rooms"][:1]
    snapshot["facultyAvailability"] = [
        {"facultyId": person["id"], "timeSlotId": first_slot["id"], "available": True}
        for person in snapshot["faculty"]
    ]
    assert generate_timetable(snapshot)["status"] == "INFEASIBLE"


def test_faculty_collision_prevents_parallel_sessions() -> None:
    snapshot = fixture()
    snapshot["studentGroups"] = snapshot["studentGroups"][1:]
    snapshot["allocations"] = snapshot["allocations"][1:]
    snapshot["allocations"][1]["facultyId"] = snapshot["allocations"][0]["facultyId"]
    snapshot["weeklyRequirements"][0]["lectureCount"] = 1
    first_slot = snapshot["timeSlots"][0]
    snapshot["timeSlots"] = [first_slot]
    snapshot["facultyAvailability"] = [
        {
            "facultyId": snapshot["faculty"][0]["id"],
            "timeSlotId": first_slot["id"],
            "available": True,
        }
    ]
    assert generate_timetable(snapshot)["status"] == "INFEASIBLE"


def test_faculty_cannot_be_double_booked_across_semesters() -> None:
    snapshot = fixture()
    # Add a second semester, section, group and subject using the same teacher.
    sem = "00000000-0000-4000-8000-000000000030"
    sec = "00000000-0000-4000-8000-000000000031"
    grp = "00000000-0000-4000-8000-000000000032"
    sub = "00000000-0000-4000-8000-000000000033"
    alloc = "00000000-0000-4000-8000-000000000034"
    snapshot["semesters"].append(
        {"id": sem, "academicYearId": snapshot["academicYear"]["id"], "number": 4}
    )
    snapshot["sections"].append({"id": sec, "semesterId": sem, "name": "B"})
    snapshot["studentGroups"].append(
        {
            "id": grp,
            "sectionId": sec,
            "semesterId": sem,
            "name": "Whole",
            "wholeSection": True,
        }
    )
    snapshot["subjects"].append(
        {"id": sub, "semesterId": sem, "code": "S4", "name": "Semester 4"}
    )
    snapshot["weeklyRequirements"].append(
        {"subjectId": sub, "semesterId": sem, "sectionId": None, "lectureCount": 1}
    )
    snapshot["allocations"].append(
        {
            "id": alloc,
            "facultyId": snapshot["faculty"][0]["id"],
            "subjectId": sub,
            "semesterId": sem,
            "studentGroupId": grp,
        }
    )
    extra_slot = "00000000-0000-4000-8000-000000000040"
    snapshot["timeSlots"].append(
        {
            "id": extra_slot,
            "academicYearId": snapshot["academicYear"]["id"],
            "weekday": 2,
            "startsAtMinute": 540,
            "endsAtMinute": 600,
            "protectedBreak": False,
        }
    )
    snapshot["facultyAvailability"].append(
        {
            "facultyId": snapshot["faculty"][0]["id"],
            "timeSlotId": extra_slot,
            "available": True,
        }
    )
    result = generate_timetable(snapshot)
    assert result["status"] == "FEASIBLE"
    faculty_slots = {}
    for item in result["placements"]:
        allocation = next(
            row for row in snapshot["allocations"] if row["id"] == item["allocationId"]
        )
        faculty_slots.setdefault(allocation["facultyId"], []).append(item["timeSlotId"])
    assert len(faculty_slots[snapshot["faculty"][0]["id"]]) == 3
    assert len(set(faculty_slots[snapshot["faculty"][0]["id"]])) == 3


def test_daily_and_consecutive_limits_are_applied() -> None:
    snapshot = fixture()
    snapshot["academicYear"]["regularDailyClasses"] = 1
    snapshot["academicYear"]["maxTotalDailyPeriods"] = 1
    snapshot["academicYear"]["maxConsecutivePeriods"] = 1
    result = generate_timetable(snapshot)
    assert result["status"] == "INFEASIBLE"


def test_overlapping_input_slots_are_invalid() -> None:
    snapshot = fixture()
    snapshot["timeSlots"].append(
        {
            **snapshot["timeSlots"][0],
            "id": "new-slot",
            "startsAtMinute": 570,
            "endsAtMinute": 630,
        }
    )
    result = generate_timetable(snapshot)
    assert result["status"] == "INVALID_INPUT"
    assert "OVERLAPPING_TIME_SLOTS" in {item["code"] for item in result["diagnostics"]}


def test_timeout_without_solution_is_unknown(monkeypatch) -> None:
    class TimedOutSolver:
        def __init__(self):
            self.parameters = SimpleNamespace()

        def solve(self, _model):
            return cp_model.UNKNOWN

    monkeypatch.setattr(solver_module.cp_model, "CpSolver", TimedOutSolver)
    result = generate_timetable(fixture())
    assert result["status"] == "UNKNOWN"
    assert result["placements"] == []
