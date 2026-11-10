import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { promisify } from "node:util";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/database.js";

test("shared drafts, conflict validation and immutable authorized publication", async () => {
  assert.ok(
    process.env.TEST_DATABASE_URL,
    "Set TEST_DATABASE_URL to a dedicated test database.",
  );
  const schema = `timetable_test_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.searchParams.set("schema", schema);
  const db = connectDatabase(url.href);
  const cleanup = connectDatabase(process.env.TEST_DATABASE_URL);
  const editor = {
    id: "editor",
    token: randomUUID().replaceAll("-", ""),
    publish: false,
  };
  const publisher = {
    id: "publisher",
    token: randomUUID().replaceAll("-", ""),
    publish: true,
  };
  const server = createApp(db, [editor, publisher]);

  try {
    await promisify(execFile)("prisma", ["migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: url.href },
    });
    const listener = server.listen(0, "127.0.0.1");
    await once(listener, "listening");
    try {
      const address = listener.address();
      assert.ok(address && typeof address === "object");
      const origin = `http://127.0.0.1:${address.port}/api`;
      async function request(path: string, token = "", body?: object) {
        return fetch(origin + path, {
          method: body ? "POST" : "GET",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      }
      async function expectStatus(response: Response, status: number) {
        const body = await response.json();
        assert.equal(response.status, status, JSON.stringify(body));
        return body;
      }

      const year = await db.academicYear.create({
        data: {
          name: "Integration year",
          startsOn: new Date("2026-07-01"),
          endsOn: new Date("2027-06-30"),
          maxConsecutivePeriods: 1,
          maxTotalDailyPeriods: 3,
        },
      });
      const semester = await db.semester.create({
        data: { academicYearId: year.id, number: 3 },
      });
      const section = await db.section.create({
        data: { semesterId: semester.id, name: "A" },
      });
      const group = await db.studentGroup.create({
        data: {
          semesterId: semester.id,
          sectionId: section.id,
          name: "Whole section",
          wholeSection: true,
        },
      });
      const batch = await db.studentGroup.create({
        data: {
          semesterId: semester.id,
          sectionId: section.id,
          name: "Batch 1",
          wholeSection: false,
        },
      });
      const subject = await db.subject.create({
        data: { semesterId: semester.id, name: "Databases", code: "DBMS" },
      });
      const faculty = await db.faculty.create({
        data: { name: "Faculty One", facultyCode: "F1" },
      });
      const otherFaculty = await db.faculty.create({
        data: { name: "Faculty Two", facultyCode: "F2" },
      });
      const allocation = await db.teachingAllocation.create({
        data: {
          facultyId: faculty.id,
          semesterId: semester.id,
          subjectId: subject.id,
          studentGroupId: group.id,
        },
      });
      const overlap = await db.teachingAllocation.create({
        data: {
          facultyId: otherFaculty.id,
          semesterId: semester.id,
          subjectId: subject.id,
          studentGroupId: batch.id,
        },
      });
      const room = await db.room.create({ data: { name: "303" } });
      const slot = (
        weekday: number,
        startsAtMinute: number,
        protectedBreak = false,
      ) =>
        db.timeSlot.create({
          data: {
            academicYearId: year.id,
            weekday,
            startsAtMinute,
            endsAtMinute: startsAtMinute + 60,
            protectedBreak,
          },
        });
      const first = await slot(1, 540);
      const adjacent = await slot(1, 600);
      const lunch = await slot(1, 660, true);
      const second = await slot(2, 540);
      const unavailable = await slot(3, 540);
      await db.facultyAvailability.createMany({
        data: [
          { facultyId: faculty.id, timeSlotId: first.id, available: true },
          { facultyId: faculty.id, timeSlotId: adjacent.id, available: true },
          { facultyId: faculty.id, timeSlotId: second.id, available: true },
          {
            facultyId: faculty.id,
            timeSlotId: unavailable.id,
            available: false,
          },
        ],
      });
      const requirement = await db.weeklyRequirement.create({
        data: {
          semesterId: semester.id,
          subjectId: subject.id,
          lectureCount: 2,
        },
      });
      const path = `/timetables/${year.id}`;
      await expectStatus(await request(path, "", { action: "create" }), 401);
      await expectStatus(
        await request("/rooms", "", { name: "Unauthorized" }),
        401,
      );
      await expectStatus(await request("/operator", "wrong"), 401);
      const create = { action: "create" };
      const draft = (
        await expectStatus(await request(path, editor.token, create), 201)
      ).version;
      await expectStatus(await request(path, publisher.token, create), 409);
      assert.equal(
        (await expectStatus(await request(path), 200)).version,
        null,
      );
      const post = (
        action: string,
        revision: number,
        fields = {},
        token = editor.token,
      ) =>
        request(path, token, {
          action,
          versionId: draft.id,
          revision,
          ...fields,
        });
      const placement = (timeSlotId: string, allocationId = allocation.id) => ({
        placement: { allocationId, timeSlotId, roomId: room.id },
      });
      const save = (
        timeSlotId: string,
        revision: number,
        allocationId = allocation.id,
      ) => post("save", revision, placement(timeSlotId, allocationId));
      const codes = (body: { error: { issues: { code: string }[] } }) =>
        body.error.issues.map(({ code }) => code);

      await expectStatus(await post("publish", 0, {}, publisher.token), 409);
      await expectStatus(await save(first.id, 0), 200);
      const shared = await expectStatus(
        await request(path, publisher.token),
        200,
      );
      assert.equal(shared.version.revision, 1);
      assert.equal(shared.display.entries.length, 1);
      assert.deepEqual(
        new Set(codes(await expectStatus(await save(first.id, 1), 422))),
        new Set(["FACULTY_COLLISION", "ROOM_COLLISION", "GROUP_COLLISION"]),
      );
      assert.ok(
        codes(
          await expectStatus(await save(first.id, 1, overlap.id), 422),
        ).includes("GROUP_COLLISION"),
      );
      assert.ok(
        codes(await expectStatus(await save(adjacent.id, 1), 422)).includes(
          "CONSECUTIVE_LIMIT",
        ),
      );
      assert.ok(
        codes(await expectStatus(await save(lunch.id, 1), 422)).includes(
          "INVALID_PLACEMENT",
        ),
      );
      assert.ok(
        codes(await expectStatus(await save(unavailable.id, 1), 422)).includes(
          "AVAILABILITY",
        ),
      );
      assert.ok(
        codes(await expectStatus(await post("validate", 1), 422)).includes(
          "WEEKLY_REQUIREMENT",
        ),
      );

      await db.academicYear.update({
        where: { id: year.id },
        data: { regularDailyClasses: 1, maxTotalDailyPeriods: 1 },
      });
      assert.ok(
        codes(await expectStatus(await save(adjacent.id, 1), 422)).includes(
          "DAILY_LIMIT",
        ),
      );
      await db.academicYear.update({
        where: { id: year.id },
        data: { regularDailyClasses: 3, maxTotalDailyPeriods: 3 },
      });

      const competing = await Promise.all([
        save(second.id, 1),
        save(second.id, 1),
      ]);
      assert.deepEqual(
        competing.map(({ status }) => status).sort(),
        [200, 409],
      );
      const validated = (await expectStatus(await post("validate", 2), 200))
        .version;
      assert.equal(validated.status, "VALIDATED");
      await expectStatus(await post("publish", 3), 403);
      await db.weeklyRequirement.update({
        where: { id: requirement.id },
        data: { lectureCount: 3 },
      });
      await expectStatus(await post("publish", 3, {}, publisher.token), 422);
      await db.weeklyRequirement.update({
        where: { id: requirement.id },
        data: { lectureCount: 2 },
      });
      const publications = await Promise.all([
        post("publish", 3, {}, publisher.token),
        post("publish", 3, {}, publisher.token),
      ]);
      assert.deepEqual(
        publications.map(({ status }) => status).sort(),
        [200, 409],
      );
      const published = await expectStatus(await request(path), 200);
      assert.equal(published.version.publishedBy, "publisher");
      assert.ok(published.version.publishedAt);
      assert.equal(published.version.number, 1);
      await expectStatus(await save(first.id, 4), 409);
      await assert.rejects(
        db.timetableVersion.delete({ where: { id: draft.id } }),
        /immutable/i,
      );
      await assert.rejects(
        db.timetableEntry.update({
          where: { id: published.display.entries[0].id },
          data: { timeSlotId: adjacent.id },
        }),
        /immutable/i,
      );
      await db.room.update({
        where: { id: room.id },
        data: { name: "New name" },
      });
      assert.equal(
        (await expectStatus(await request(path), 200)).display.rooms[0].name,
        "303",
      );
      await expectStatus(await request(path, editor.token, create), 201);
      assert.equal(
        (await expectStatus(await request(path, editor.token), 200)).display
          .entries.length,
        2,
      );
      assert.equal(
        (await expectStatus(await request(path), 200)).version.id,
        draft.id,
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        listener.close((error) => (error ? reject(error) : resolve())),
      );
    }
  } finally {
    await db.$disconnect();
    // The schema identifier consists only of the fixed prefix and a generated hexadecimal UUID.
    try {
      await cleanup.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${schema}" CASCADE`,
      );
    } finally {
      await cleanup.$disconnect();
    }
  }
});
