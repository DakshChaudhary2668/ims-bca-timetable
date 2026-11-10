import type { Prisma } from "../generated/prisma/client.js";

export async function timetableCatalog(
  db: Prisma.TransactionClient,
  academicYearId: string,
) {
  const year = await db.academicYear.findUniqueOrThrow({
    where: { id: academicYearId },
  });
  const semesters = await db.semester.findMany({
    where: { academicYearId },
    orderBy: { number: "asc" },
    include: {
      sections: { orderBy: { name: "asc" }, include: { groups: true } },
    },
  });
  const rooms = await db.room.findMany({ orderBy: { name: "asc" } });
  const slots = await db.timeSlot.findMany({
    where: { academicYearId },
    orderBy: [{ weekday: "asc" }, { startsAtMinute: "asc" }],
  });
  const allocations = await db.teachingAllocation.findMany({
    where: { subject: { semester: { academicYearId } } },
    include: { subject: true, faculty: true, studentGroup: true },
  });
  const requirements = await db.weeklyRequirement.findMany({
    where: { subject: { semester: { academicYearId } } },
    include: { subject: true },
  });
  const availability = await db.facultyAvailability.findMany({
    where: { timeSlot: { academicYearId } },
  });
  return {
    year,
    semesters,
    rooms,
    slots,
    allocations,
    requirements,
    availability,
  };
}

type Catalog = Awaited<ReturnType<typeof timetableCatalog>>;
export type Placement = {
  id: string;
  allocationId: string;
  timeSlotId: string;
  roomId: string;
};
type Issue = { code: string; message: string; entries: string[] };

export function validateTimetable(
  catalog: Catalog,
  entries: Placement[],
  complete: boolean,
): Issue[] {
  const {
    year,
    semesters,
    rooms,
    slots,
    allocations,
    requirements,
    availability,
  } = catalog;
  const issues: Issue[] = [];
  const add = (code: string, message: string, entries: string[] = []) =>
    issues.push({ code, message, entries });
  const slotMap = new Map(slots.map((slot) => [slot.id, slot]));
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const allocationMap = new Map(
    allocations.map((allocation) => [allocation.id, allocation]),
  );
  const availabilityMap = new Map(
    availability.map((row) => [
      `${row.facultyId}/${row.timeSlotId}`,
      row.available,
    ]),
  );
  const bySlot = new Map<string, Placement[]>();
  const daily = new Map<string, Placement[]>();
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const slot = slotMap.get(entry.timeSlotId);
    const allocation = allocationMap.get(entry.allocationId);
    if (
      !slot ||
      slot.protectedBreak ||
      !allocation ||
      !roomMap.has(entry.roomId)
    ) {
      add(
        "INVALID_PLACEMENT",
        "Use a teaching period, room and allocation from the selected academic year.",
        [entry.id],
      );
      continue;
    }

    const { faculty, studentGroup, subject } = allocation;
    const allowed = availabilityMap.get(`${faculty.id}/${slot.id}`);
    if (
      !faculty.active ||
      allowed === false ||
      (complete && allowed === undefined)
    )
      add(
        "AVAILABILITY",
        `${faculty.name} is unavailable or has no confirmed availability for this period.`,
        [entry.id],
      );
    if (complete && studentGroup.wholeSection === null)
      add(
        "GROUP_SCOPE",
        `Set the scope of teaching group ${studentGroup.name} before publication.`,
        [entry.id],
      );

    const others = bySlot.get(slot.id) ?? [];
    for (const other of others) {
      const prior = allocationMap.get(other.allocationId)!;
      const pair = [other.id, entry.id];
      if (faculty.id === prior.facultyId)
        add(
          "FACULTY_COLLISION",
          `${faculty.name} already teaches in this period.`,
          pair,
        );
      if (entry.roomId === other.roomId)
        add(
          "ROOM_COLLISION",
          `Room ${roomMap.get(entry.roomId)?.name} is already in use.`,
          pair,
        );
      const priorGroup = prior.studentGroup;
      if (
        studentGroup.sectionId === priorGroup.sectionId &&
        (studentGroup.id === priorGroup.id ||
          studentGroup.wholeSection !== false ||
          priorGroup.wholeSection !== false)
      ) {
        add(
          "GROUP_COLLISION",
          `The teaching groups ${studentGroup.name} and ${priorGroup.name} overlap or their scope is unconfirmed.`,
          pair,
        );
      }
    }
    others.push(entry);
    bySlot.set(slot.id, others);

    const dayKey = `${faculty.id}/${slot.weekday}`;
    const periods = daily.get(dayKey) ?? [];
    if (!periods.some((period) => period.timeSlotId === slot.id))
      periods.push(entry);
    daily.set(dayKey, periods);

    const countKey = `${studentGroup.sectionId}/${subject.id}/${studentGroup.wholeSection ? "whole" : studentGroup.id}`;
    counts.set(countKey, (counts.get(countKey) ?? 0) + 1);
  }

  const sequence = new Map<string, number>();
  const daySequence = new Map<number, number>();
  for (const slot of slots) {
    // A configured protected break occupies a sequence position and ends a teaching run.
    const index = (daySequence.get(slot.weekday) ?? -1) + 1;
    daySequence.set(slot.weekday, index);
    sequence.set(slot.id, index);
  }
  for (const periods of daily.values()) {
    const faculty = allocationMap.get(periods[0].allocationId)!.faculty;
    if (
      year.maxTotalDailyPeriods !== null &&
      periods.length > year.maxTotalDailyPeriods
    )
      add(
        "DAILY_LIMIT",
        `${faculty.name} exceeds the configured daily teaching limit.`,
        periods.map(({ id }) => id),
      );
    if (year.maxConsecutivePeriods === null) continue;
    const ordered = [...periods].sort(
      (a, b) => sequence.get(a.timeSlotId)! - sequence.get(b.timeSlotId)!,
    );
    let run: Placement[] = [];
    for (const period of ordered) {
      const previous = run.at(-1);
      if (
        previous &&
        sequence.get(period.timeSlotId)! - sequence.get(previous.timeSlotId)! >
          1
      ) {
        if (run.length > year.maxConsecutivePeriods)
          add(
            "CONSECUTIVE_LIMIT",
            `${faculty.name} exceeds the configured consecutive teaching limit.`,
            run.map(({ id }) => id),
          );
        run = [];
      }
      run.push(period);
    }
    if (run.length > year.maxConsecutivePeriods)
      add(
        "CONSECUTIVE_LIMIT",
        `${faculty.name} exceeds the configured consecutive teaching limit.`,
        run.map(({ id }) => id),
      );
  }

  if (!complete) return issues;
  if (entries.length === 0)
    add("EMPTY", "Schedule at least one teaching session before validating.");

  const quotas = new Map(
    requirements.map((row) => [
      `${row.sectionId ?? row.semesterId}/${row.subjectId}`,
      row.lectureCount,
    ]),
  );
  for (const semester of semesters) {
    for (const section of semester.sections) {
      const subjects = new Map(
        requirements
          .filter(
            (row) =>
              row.semesterId === semester.id &&
              (!row.sectionId || row.sectionId === section.id),
          )
          .map(({ subject }) => [subject.id, subject.code]),
      );
      for (const allocation of allocations) {
        if (allocation.studentGroup.sectionId === section.id)
          subjects.set(allocation.subjectId, allocation.subject.code);
      }
      const batches = section.groups.filter(
        (group) => group.wholeSection === false,
      );
      for (const [subjectId, code] of subjects) {
        const expected =
          quotas.get(`${section.id}/${subjectId}`) ??
          quotas.get(`${semester.id}/${subjectId}`);
        if (expected === undefined) {
          add(
            "MISSING_QUOTA",
            `Configure a weekly requirement for ${code}, Semester ${semester.number} Section ${section.name}.`,
          );
          continue;
        }
        const prefix = `${section.id}/${subjectId}/`;
        const whole = counts.get(prefix + "whole") ?? 0;
        for (const batch of batches.length ? batches : [null]) {
          const actual =
            whole + (batch ? (counts.get(prefix + batch.id) ?? 0) : 0);
          if (actual !== expected)
            add(
              "WEEKLY_REQUIREMENT",
              `${code}, Semester ${semester.number} Section ${section.name}${batch ? ` (${batch.name})` : ""}: ${actual} of ${expected} required periods.`,
            );
        }
      }
    }
  }
  return issues;
}

export function timetableDisplay(catalog: Catalog, entries: Placement[]) {
  const { semesters, slots, allocations, rooms } = catalog;
  return { semesters, slots, allocations, rooms, entries };
}
