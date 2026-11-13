# API contracts

These endpoints exist in Express. The browser accesses `/api/*` through an allowlisted Next.js proxy. The Express default is `127.0.0.1:4000`. Express `GET /health` returns 200 with `{"status":"ok"}` when PostgreSQL responds and 503 with `{"status":"unavailable"}` otherwise.

Send `Authorization: Bearer <operator-key>` for writes and draft reads. `GET /api/operator` requires a key and returns `{id,publish}`. Unauthenticated reads can see academic catalog records and published timetables. There is no login POST or browser session cookie.

## Academic resources

Each resource supports `GET /api/<resource>` (array), `GET /api/<resource>/:id`, `POST /api/<resource>` (201), `PUT /api/<resource>/:id` (200), and `DELETE /api/<resource>/:id` (204). Writes use JSON. IDs are UUIDs. Dates are sent as `YYYY-MM-DD` and returned at UTC midnight. Unexpected fields are rejected. Supply all required fields on PUT. Schema defaults are applied when omitted. Optional fields without defaults, such as `wholeSection` and `maxConsecutivePeriods`, can be set explicitly to null.

| Resource               | Writable fields                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `academic-years`       | `name`, `startsOn`, `endsOn`, `regularDailyClasses` (default 3), `maxTotalDailyPeriods` (default null), `maxConsecutivePeriods` (nullable, optional) |
| `semesters`            | `academicYearId`, `number`                                                                                                                           |
| `sections`             | `semesterId`, `name`                                                                                                                                 |
| `student-groups`       | `sectionId`, `semesterId`, `name`, `wholeSection` (nullable, optional)                                                                               |
| `subjects`             | `semesterId`, `code`, `name`                                                                                                                         |
| `weekly-requirements`  | `subjectId`, `semesterId`, `sectionId` (default null), `lectureCount`                                                                                |
| `faculty`              | `facultyCode`, `name`, `active` (default true)                                                                                                       |
| `faculty-eligibility`  | `facultyId`, `subjectId`                                                                                                                             |
| `teaching-allocations` | `facultyId`, `subjectId`, `studentGroupId`, `semesterId`                                                                                             |
| `rooms`                | `name`                                                                                                                                               |
| `time-slots`           | `academicYearId`, `weekday`, `startsAtMinute`, `endsAtMinute`, `protectedBreak` (default false)                                                      |
| `faculty-availability` | `facultyId`, `timeSlotId`, `available`                                                                                                               |

## Timetable endpoints

`GET /api/timetables/:academicYearId?versionId=<uuid>` returns `{versions,version,display}`. The query is optional. With no query, authenticated users see the working version first if present. Others see the latest published version. The selected `version` can be null. `display` contains `semesters`, `slots`, `rooms`, `allocations` and `entries`. Published displays come from the stored snapshot. A summary has `id`, `status`, `revision`, nullable `number`, `publishedAt` and `publishedBy`.

Send commands as JSON to `POST /api/timetables/:academicYearId`. The response is `{version}` with status 201 for create and 200 otherwise.

| `action`   | Other request fields                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| `create`   | None. Fails if a working version exists.                                                             |
| `save`     | `versionId`, `revision`, optional `entryId`, `placement` with `allocationId`, `timeSlotId`, `roomId` |
| `remove`   | `versionId`, `revision`, `entryId`                                                                   |
| `validate` | `versionId`, `revision`                                                                              |
| `publish`  | `versionId`, `revision`. Requires a publishing operator and a validated working version.             |

Successful non-create commands increment the revision. Saves and removes return the version to DRAFT. Publication revalidates and freezes the version. Reload and review after a 409 before retrying.

## Errors

Errors contain `error.message`. Many CRUD errors also include `error.code`. Zod issues use `{field,message}`. Timetable rules use `{code,message,entries}`, where `entries` is a list of affected placement IDs. Relevant statuses are 400 malformed/invalid input, 401 missing operator authorization, 403 denied publication, 404 unknown record, 409 duplicates or stale/conflicting writes, 413 oversized JSON, 415 non-JSON proxy write, 422 invalid reference or scheduling rules, 500 unexpected API failure, and 503 unavailable dependency. Express JSON bodies are limited to 32 KB.

## Proposed scheduler contract

The [solver contract](TIMETABLE_ENGINE.md) defines the internal Node-to-Python interface. A standalone Python core implements contract v1, but no generation, bulk import, or substitution API is registered.
