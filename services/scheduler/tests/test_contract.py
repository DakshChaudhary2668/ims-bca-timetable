import json
from pathlib import Path

from scheduler import generate_timetable

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_feasible_fixture_returns_complete_contract_proposal() -> None:
    snapshot = load("feasible.json")
    result = generate_timetable(snapshot)
    assert result["status"] == "FEASIBLE"
    assert result["requestId"] == snapshot["requestId"]
    assert result["draft"] == snapshot["draft"]
    assert len(result["placements"]) == 3
    allocation_ids = {row["id"] for row in snapshot["allocations"]}
    slot_ids = {row["id"] for row in snapshot["timeSlots"] if not row["protectedBreak"]}
    room_ids = {row["id"] for row in snapshot["rooms"]}
    assert all(row["allocationId"] in allocation_ids for row in result["placements"])
    assert all(row["timeSlotId"] in slot_ids for row in result["placements"])
    assert all(row["roomId"] in room_ids for row in result["placements"])
    assert result["diagnostics"] == []


def test_infeasible_fixture_does_not_fabricate_placements() -> None:
    result = generate_timetable(load("infeasible.json"))
    assert result["status"] == "INFEASIBLE"
    assert result["placements"] == []
    assert result["diagnostics"]


def test_invalid_input_missing_quota() -> None:
    snapshot = load("feasible.json")
    snapshot["weeklyRequirements"] = []
    result = generate_timetable(snapshot)
    assert result["status"] == "INVALID_INPUT"
    assert "MISSING_QUOTA" in {item["code"] for item in result["diagnostics"]}


def test_positive_requirement_without_allocation_is_invalid_input() -> None:
    snapshot = load("feasible.json")
    snapshot["allocations"] = []
    result = generate_timetable(snapshot)
    assert result["status"] == "INVALID_INPUT"
    assert "MISSING_ALLOCATION" in {item["code"] for item in result["diagnostics"]}


def test_repeated_inputs_are_deterministic() -> None:
    snapshot = load("feasible.json")
    assert generate_timetable(snapshot) == generate_timetable(snapshot)


def test_bad_reference_is_invalid_input() -> None:
    snapshot = load("feasible.json")
    snapshot["allocations"][0]["facultyId"] = "missing-faculty"
    result = generate_timetable(snapshot)
    assert result["status"] == "INVALID_INPUT"
    assert "UNKNOWN_FACULTY" in {item["code"] for item in result["diagnostics"]}
