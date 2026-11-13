"""Typed schema for the version 1 timetable solver contract."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Draft(ContractModel):
    versionId: str
    revision: int = Field(ge=0)


class AcademicYear(ContractModel):
    id: str
    name: str
    startsOn: date = Field(strict=False)
    endsOn: date = Field(strict=False)
    regularDailyClasses: int = Field(default=3, ge=1)
    maxTotalDailyPeriods: int | None = Field(default=None, ge=1)
    maxConsecutivePeriods: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def check_year_limits(self) -> "AcademicYear":
        if self.endsOn < self.startsOn:
            raise ValueError("endsOn must be on or after startsOn")
        if (
            self.maxTotalDailyPeriods is not None
            and self.maxTotalDailyPeriods < self.regularDailyClasses
        ):
            raise ValueError(
                "maxTotalDailyPeriods must be at least regularDailyClasses"
            )
        return self


class Semester(ContractModel):
    id: str
    academicYearId: str
    number: int = Field(ge=1, le=6)


class Section(ContractModel):
    id: str
    semesterId: str
    name: str


class StudentGroup(ContractModel):
    id: str
    sectionId: str
    semesterId: str
    name: str
    wholeSection: bool | None


class Subject(ContractModel):
    id: str
    semesterId: str
    code: str
    name: str


class WeeklyRequirement(ContractModel):
    subjectId: str
    semesterId: str
    sectionId: str | None
    lectureCount: int = Field(ge=0)


class Faculty(ContractModel):
    id: str
    facultyCode: str
    name: str
    active: bool = True


class Allocation(ContractModel):
    id: str
    facultyId: str
    subjectId: str
    semesterId: str
    studentGroupId: str


class Room(ContractModel):
    id: str
    name: str


class TimeSlot(ContractModel):
    id: str
    academicYearId: str
    weekday: int = Field(ge=1, le=7)
    startsAtMinute: int = Field(ge=0, lt=1440)
    endsAtMinute: int = Field(gt=0, le=1440)
    protectedBreak: bool = False


class FacultyAvailability(ContractModel):
    facultyId: str
    timeSlotId: str
    available: bool


class Snapshot(ContractModel):
    schemaVersion: int = Field(ge=1)
    requestId: str
    draft: Draft
    academicYear: AcademicYear
    semesters: list[Semester]
    sections: list[Section]
    studentGroups: list[StudentGroup]
    subjects: list[Subject]
    weeklyRequirements: list[WeeklyRequirement]
    faculty: list[Faculty]
    allocations: list[Allocation]
    rooms: list[Room]
    timeSlots: list[TimeSlot]
    facultyAvailability: list[FacultyAvailability]


class Diagnostic(ContractModel):
    code: str
    message: str
    subjectId: str | None = None
    studentGroupId: str | None = None
    allocationId: str | None = None
    timeSlotId: str | None = None
