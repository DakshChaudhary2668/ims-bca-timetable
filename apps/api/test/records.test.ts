import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/database.js";

test("academic records enforce validation, identity, and semester boundaries", async (t) => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, "Set TEST_DATABASE_URL to a migrated test database.");
  const db = connectDatabase(url);
  t.after(() => db.$disconnect());
  const token = randomUUID().replaceAll("-", "");
  const server = createApp(db, [{ id: "test", token, publish: false }]).listen(
    0,
    "127.0.0.1",
  );
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  const created: string[] = [];

  async function request(
    path: string,
    status: number,
    method = "GET",
    body?: object,
  ) {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = response.status === 204 ? null : await response.json();
    if (method === "POST" && response.status === 201)
      created.push(`${path}/${payload.id}`);
    assert.equal(response.status, status, JSON.stringify(payload));
    return payload;
  }

  const create = (resource: string, body: object, status = 201) =>
    request(`/api/${resource}`, status, "POST", body);
  const unique = randomUUID().slice(0, 12);
  const dates = {
    name: `Integration ${unique}`,
    startsOn: "2026-07-01",
    endsOn: "2027-06-30",
  };

  try {
    await request("/health", 200);
    await t.test(
      "rejects invalid calendar dates, reversed dates and an invalid daily limit",
      async () => {
        await create(
          "academic-years",
          { ...dates, startsOn: "2026-02-30" },
          400,
        );
        await create("academic-years", { ...dates, endsOn: "2026-06-01" }, 400);
        await create(
          "academic-years",
          { ...dates, maxTotalDailyPeriods: 2 },
          400,
        );
      },
    );

    const year = await create("academic-years", dates);
    assert.equal(year.regularDailyClasses, 3);
    assert.equal(year.maxTotalDailyPeriods, null);
    const first = await create("semesters", {
      academicYearId: year.id,
      number: 1,
    });
    const third = await create("semesters", {
      academicYearId: year.id,
      number: 3,
    });
    const faculty = await create("faculty", {
      facultyCode: unique,
      name: "Integration faculty",
    });

    await t.test(
      "rejects duplicate faculty IDs after normalisation",
      async () => {
        const duplicate = await create(
          "faculty",
          { facultyCode: ` ${unique.toUpperCase()} `, name: "Duplicate" },
          409,
        );
        assert.equal(duplicate.error.code, "DUPLICATE");
      },
    );

    const sectionA = await create("sections", {
      semesterId: first.id,
      name: "A",
    });
    const sectionB = await create("sections", {
      semesterId: first.id,
      name: "B",
    });
    const sectionThird = await create("sections", {
      semesterId: third.id,
      name: "A",
    });
    const group = (section: { id: string; semesterId: string }) =>
      create("student-groups", {
        sectionId: section.id,
        semesterId: section.semesterId,
        name: "Whole section",
      });
    const groupA = await group(sectionA);
    const groupB = await group(sectionB);
    const groupThird = await group(sectionThird);
    const subject = await create("subjects", {
      semesterId: first.id,
      code: "BCA101",
      name: "Integration subject",
    });
    const subjectThird = await create("subjects", {
      semesterId: third.id,
      code: "BCA301",
      name: "Integration subject III",
    });
    const requirement = {
      semesterId: first.id,
      subjectId: subject.id,
      lectureCount: 3,
    };
    const allocation = {
      semesterId: first.id,
      facultyId: faculty.id,
      subjectId: subject.id,
      studentGroupId: groupA.id,
    };

    await t.test(
      "rejects invalid counts and duplicate defaults and allows section overrides",
      async () => {
        await create(
          "weekly-requirements",
          { ...requirement, lectureCount: -1 },
          400,
        );
        await create(
          "weekly-requirements",
          { ...requirement, lectureCount: 2.5 },
          400,
        );
        const entry = await create("weekly-requirements", requirement);
        assert.equal(entry.sectionId, null);
        await create(
          "weekly-requirements",
          { ...requirement, sectionId: null },
          409,
        );
        await create("weekly-requirements", {
          ...requirement,
          sectionId: sectionB.id,
          lectureCount: 0,
        });
        await create(
          "weekly-requirements",
          { ...requirement, sectionId: sectionThird.id },
          422,
        );
      },
    );

    await t.test(
      "rejects missing references and cross-semester allocations",
      async () => {
        await create(
          "faculty-eligibility",
          { facultyId: randomUUID(), subjectId: subject.id },
          422,
        );
        await create(
          "faculty-eligibility",
          { facultyId: faculty.id, subjectId: randomUUID() },
          422,
        );
        await create("faculty-eligibility", {
          facultyId: faculty.id,
          subjectId: subject.id,
        });
        await create(
          "teaching-allocations",
          { ...allocation, facultyId: randomUUID() },
          422,
        );
        await create(
          "teaching-allocations",
          { ...allocation, subjectId: randomUUID() },
          422,
        );
        await create(
          "teaching-allocations",
          { ...allocation, studentGroupId: groupThird.id },
          422,
        );
      },
    );

    await t.test(
      "rejects duplicate allocations but permits distinct sections in the same semester",
      async () => {
        await create("teaching-allocations", allocation);
        await create("teaching-allocations", allocation, 409);
        await create("teaching-allocations", {
          ...allocation,
          studentGroupId: groupB.id,
        });
      },
    );

    await t.test(
      "shares a faculty identity across semesters and protects dependent records",
      async () => {
        const other = await create("teaching-allocations", {
          ...allocation,
          semesterId: third.id,
          subjectId: subjectThird.id,
          studentGroupId: groupThird.id,
        });
        assert.equal(other.facultyId, faculty.id);
        await request(`/api/faculty/${faculty.id}`, 409, "DELETE");
        const edited = await request(`/api/faculty/${faculty.id}`, 200, "PUT", {
          facultyCode: unique,
          name: "Updated faculty",
          active: false,
        });
        assert.equal(edited.active, false);
        assert.equal(
          (await request(`/api/faculty/${faculty.id}`, 200)).name,
          "Updated faculty",
        );
        const allocations = await request("/api/teaching-allocations", 200);
        assert.equal(
          allocations.filter(
            (row: { facultyId: string }) => row.facultyId === faculty.id,
          ).length,
          3,
        );
      },
    );
  } finally {
    for (const path of created.reverse()) await request(path, 204, "DELETE");
  }
});
