import { z } from "zod";

const name = z.string().trim().min(1).max(120);
const code = z.string().trim().min(1).max(30).toUpperCase();
export const id = z.uuid();
const date = z.iso.date();

export const schemas = {
  "academic-years": z
    .strictObject({
      name,
      startsOn: date,
      endsOn: date,
      regularDailyClasses: z.int32().nonnegative().default(3),
      maxConsecutivePeriods: z.int32().positive().nullable().optional(),
      maxTotalDailyPeriods: z.int32().positive().nullable().default(null),
    })
    .refine((year) => year.startsOn <= year.endsOn, {
      message: "End date must be on or after the start date.",
      path: ["endsOn"],
    })
    .refine(
      (year) =>
        year.maxTotalDailyPeriods === null ||
        year.maxTotalDailyPeriods >= year.regularDailyClasses,
      {
        message: "The total daily limit must cover the regular classes.",
        path: ["maxTotalDailyPeriods"],
      },
    )
    .transform((year) => ({
      ...year,
      startsOn: new Date(year.startsOn),
      endsOn: new Date(year.endsOn),
    })),
  semesters: z.strictObject({
    academicYearId: id,
    number: z.int32().min(1).max(6),
  }),
  sections: z.strictObject({ semesterId: id, name: code }),
  "student-groups": z.strictObject({
    sectionId: id,
    semesterId: id,
    name,
    wholeSection: z.boolean().nullable().optional(),
  }),
  rooms: z.strictObject({ name }),
  "time-slots": z
    .strictObject({
      academicYearId: id,
      weekday: z.int32().min(1).max(7),
      startsAtMinute: z.int32().min(0).max(1439),
      endsAtMinute: z.int32().min(1).max(1440),
      protectedBreak: z.boolean().default(false),
    })
    .refine((slot) => slot.startsAtMinute < slot.endsAtMinute, {
      path: ["endsAtMinute"],
      message: "End time must follow start time.",
    }),
  "faculty-availability": z.strictObject({
    facultyId: id,
    timeSlotId: id,
    available: z.boolean(),
  }),
  subjects: z.strictObject({ semesterId: id, code, name }),
  "weekly-requirements": z.strictObject({
    subjectId: id,
    semesterId: id,
    sectionId: id.nullable().default(null),
    lectureCount: z.int32().nonnegative(),
  }),
  faculty: z.strictObject({
    facultyCode: code,
    name,
    active: z.boolean().default(true),
  }),
  "faculty-eligibility": z.strictObject({ facultyId: id, subjectId: id }),
  "teaching-allocations": z.strictObject({
    facultyId: id,
    subjectId: id,
    studentGroupId: id,
    semesterId: id,
  }),
};
