import { z } from "zod";

const value = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const rowSchema = z.object({ id: z.uuid() }).catchall(value);
export type Row = z.infer<typeof rowSchema>;

type Field = {
  key: string;
  label: string;
  kind?: "date" | "number" | "boolean";
  ref?: Resource;
  optional?: boolean;
  defaultValue?: string;
  min?: number;
  max?: number;
};

type ResourceDefinition = {
  title: string;
  singular: string;
  fields: Field[];
  empty: string;
};
export type Resource =
  | "academic-years"
  | "semesters"
  | "sections"
  | "student-groups"
  | "subjects"
  | "weekly-requirements"
  | "faculty"
  | "faculty-eligibility"
  | "teaching-allocations"
  | "rooms"
  | "time-slots"
  | "faculty-availability";

const semester: Field = {
  key: "semesterId",
  label: "Semester",
  ref: "semesters",
};
const section: Field = { key: "sectionId", label: "Section", ref: "sections" };
const subject: Field = { key: "subjectId", label: "Subject", ref: "subjects" };
const faculty: Field = {
  key: "facultyId",
  label: "Faculty member",
  ref: "faculty",
};
const name: Field = { key: "name", label: "Name" };

export const resources: Record<Resource, ResourceDefinition> = {
  rooms: {
    title: "Rooms",
    singular: "room",
    empty: "Add the rooms available for classes.",
    fields: [name],
  },
  "time-slots": {
    title: "Time slots",
    singular: "time slot",
    empty:
      "Add weekly teaching periods and protected breaks. Times use minutes since midnight.",
    fields: [
      { key: "academicYearId", label: "Academic year", ref: "academic-years" },
      {
        key: "weekday",
        label: "Weekday (Mon 1 – Sun 7)",
        kind: "number",
        min: 1,
        max: 7,
      },
      {
        key: "startsAtMinute",
        label: "Start minute",
        kind: "number",
        min: 0,
        max: 1439,
      },
      {
        key: "endsAtMinute",
        label: "End minute",
        kind: "number",
        min: 1,
        max: 1440,
      },
      {
        key: "protectedBreak",
        label: "Protected break",
        kind: "boolean",
        defaultValue: "false",
      },
    ],
  },
  "faculty-availability": {
    title: "Faculty availability",
    singular: "availability record",
    empty: "Confirm the periods in which faculty can teach.",
    fields: [
      faculty,
      { key: "timeSlotId", label: "Time slot", ref: "time-slots" },
      {
        key: "available",
        label: "Available",
        kind: "boolean",
        defaultValue: "true",
      },
    ],
  },
  "academic-years": {
    title: "Academic years",
    singular: "academic year",
    empty: "Add an academic year to open the semester register.",
    fields: [
      name,
      { key: "startsOn", label: "Start date", kind: "date" },
      { key: "endsOn", label: "End date", kind: "date" },
      {
        key: "regularDailyClasses",
        label: "Regular classes per day",
        kind: "number",
        min: 0,
        defaultValue: "3",
      },
      {
        key: "maxTotalDailyPeriods",
        label: "Total daily limit",
        kind: "number",
        min: 1,
        optional: true,
      },
      {
        key: "maxConsecutivePeriods",
        label: "Consecutive teaching limit",
        kind: "number",
        min: 1,
        optional: true,
      },
    ],
  },
  semesters: {
    title: "Semesters",
    singular: "semester",
    empty: "Add the semesters offered in an academic year.",
    fields: [
      { key: "academicYearId", label: "Academic year", ref: "academic-years" },
      {
        key: "number",
        label: "Semester number",
        kind: "number",
        min: 1,
        max: 6,
      },
    ],
  },
  sections: {
    title: "Sections",
    singular: "section",
    empty: "Add sections to the semesters that offer them.",
    fields: [semester, { key: "name", label: "Section name" }],
  },
  "student-groups": {
    title: "Teaching groups",
    singular: "teaching group",
    empty: "Add a group for a whole section or a batch within it.",
    fields: [
      semester,
      section,
      { key: "name", label: "Group name" },
      {
        key: "wholeSection",
        label: "Covers whole section",
        kind: "boolean",
        optional: true,
      },
    ],
  },
  faculty: {
    title: "Faculty directory",
    singular: "faculty member",
    empty: "Add faculty members before recording eligibility and allocations.",
    fields: [
      { key: "facultyCode", label: "Faculty ID" },
      name,
      { key: "active", label: "Active", kind: "boolean", defaultValue: "true" },
    ],
  },
  "faculty-eligibility": {
    title: "Subject eligibility",
    singular: "eligibility record",
    empty: "Record the subjects each faculty member is qualified to teach.",
    fields: [faculty, subject],
  },
  "teaching-allocations": {
    title: "Teaching allocations",
    singular: "allocation",
    empty: "Allocate a subject and teaching group to a faculty member.",
    fields: [
      faculty,
      semester,
      subject,
      { key: "studentGroupId", label: "Teaching group", ref: "student-groups" },
    ],
  },
  subjects: {
    title: "Subjects",
    singular: "subject",
    empty: "Add subjects to the semester in which they are taught.",
    fields: [semester, { key: "code", label: "Subject code" }, name],
  },
  "weekly-requirements": {
    title: "Weekly lecture requirements",
    singular: "weekly requirement",
    empty:
      "Set a default lecture count per subject, with section overrides where needed.",
    fields: [
      semester,
      subject,
      { ...section, optional: true },
      {
        key: "lectureCount",
        label: "Lectures per week",
        kind: "number",
        min: 0,
      },
    ],
  },
};

export const screens = {
  setup: {
    title: "Academic setup",
    description:
      "Organise academic years, semesters, sections and teaching groups.",
    resources: [
      "academic-years",
      "semesters",
      "sections",
      "student-groups",
      "rooms",
      "time-slots",
    ],
  },
  faculty: {
    title: "Faculty management",
    description:
      "Maintain the faculty directory, subject eligibility and teaching allocations.",
    resources: [
      "faculty",
      "faculty-eligibility",
      "teaching-allocations",
      "faculty-availability",
    ],
  },
  subjects: {
    title: "Subjects and requirements",
    description: "Maintain the subject register and set weekly lecture quotas.",
    resources: ["subjects", "weekly-requirements"],
  },
} satisfies Record<
  string,
  { title: string; description: string; resources: Resource[] }
>;

export type Data = Partial<Record<Resource, Row[]>>;

function lookup(data: Data, resource: Resource, id: unknown) {
  return data[resource]?.find((row) => row.id === id);
}

export function rowLabel(resource: Resource, row: Row, data: Data): string {
  if (resource === "semesters") {
    const year = lookup(data, "academic-years", row.academicYearId);
    return year
      ? `${year.name} · Semester ${row.number}`
      : `Semester ${row.number}`;
  }
  if (resource === "sections" || resource === "subjects") {
    const parent = lookup(data, "semesters", row.semesterId);
    const label =
      resource === "subjects"
        ? `${row.code} · ${row.name}`
        : `Section ${row.name}`;
    return parent ? `${label} · ${rowLabel("semesters", parent, data)}` : label;
  }
  if (resource === "student-groups") {
    const parent = lookup(data, "sections", row.sectionId);
    return parent
      ? `${row.name} · ${rowLabel("sections", parent, data)}`
      : String(row.name);
  }
  if (resource === "time-slots") {
    const year = lookup(data, "academic-years", row.academicYearId);
    const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
      Number(row.weekday) - 1
    ];
    const clock = (minute: number) =>
      `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    return `${year?.name ?? ""} · ${weekday} ${clock(Number(row.startsAtMinute))}–${clock(Number(row.endsAtMinute))}`;
  }
  if (resource === "faculty") return `${row.name} · ${row.facultyCode}`;
  return String(row.name ?? row.id);
}
