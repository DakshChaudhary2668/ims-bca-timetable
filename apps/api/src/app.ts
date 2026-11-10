import express, { type ErrorRequestHandler } from "express";
import { z } from "zod";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { authenticate, requireOperator, type Operator } from "./operators.js";
import { timetables } from "./timetables.js";
import { id, schemas } from "./schemas.js";

function crud<T>(
  schema: z.ZodType<T>,
  model: {
    findMany: (args: { orderBy: { id: "asc" } }) => PromiseLike<unknown>;
    findUniqueOrThrow: (args: {
      where: { id: string };
    }) => PromiseLike<unknown>;
    create: (args: { data: T }) => PromiseLike<unknown>;
    update: (args: { where: { id: string }; data: T }) => PromiseLike<unknown>;
    delete: (args: { where: { id: string } }) => PromiseLike<unknown>;
  },
) {
  const router = express.Router();
  router.get("/", async (_req, res) => {
    res.json(await model.findMany({ orderBy: { id: "asc" } }));
  });
  router.get("/:id", async (req, res) => {
    res.json(
      await model.findUniqueOrThrow({ where: { id: id.parse(req.params.id) } }),
    );
  });
  router.post("/", async (req, res) => {
    res.status(201).json(await model.create({ data: schema.parse(req.body) }));
  });
  router.put("/:id", async (req, res) => {
    res.json(
      await model.update({
        where: { id: id.parse(req.params.id) },
        data: schema.parse(req.body),
      }),
    );
  });
  router.delete("/:id", async (req, res) => {
    await model.delete({ where: { id: id.parse(req.params.id) } });
    res.status(204).end();
  });
  return router;
}

const handleError: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Check the submitted fields.",
        issues: error.issues.map(({ path, message }) => ({
          field: path.join("."),
          message,
        })),
      },
    });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2034") {
      res.status(409).json({
        error: { message: "Another change was saved. Reload and try again." },
      });
      return;
    }
    if (error.code === "P2002") {
      res.status(409).json({
        error: {
          code: "DUPLICATE",
          message: "A record with these identifiers already exists.",
        },
      });
      return;
    }
    if (error.code === "P2003") {
      const deleting = req.method === "DELETE";
      res.status(deleting ? 409 : 422).json({
        error: {
          code: deleting ? "IN_USE" : "INVALID_REFERENCE",
          message: deleting
            ? "Remove dependent records before deleting this record."
            : "A related record is missing or belongs to a different semester.",
        },
      });
      return;
    }
    if (error.code === "P2025") {
      res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Record not found." } });
      return;
    }
    if (error.code === "P2004") {
      res.status(422).json({
        error: {
          code: "CONSTRAINT",
          message: "The change violates a database constraint.",
        },
      });
      return;
    }
  }
  if (
    error?.type === "entity.parse.failed" ||
    error?.type === "entity.too.large"
  ) {
    const tooLarge = error.type === "entity.too.large";
    res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON",
        message: tooLarge
          ? "Request body is too large."
          : "Send a valid JSON body.",
      },
    });
    return;
  }
  console.error(
    "API request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  res.status(500).json({
    error: { code: "INTERNAL", message: "Unable to complete the request." },
  });
};

export function createApp(db: PrismaClient, operators: Operator[] = []) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.get("/health", async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  app.use("/api", authenticate(operators), (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (["GET", "HEAD"].includes(req.method)) next();
    else requireOperator(req, res, next);
  });
  app.get("/api/operator", requireOperator, (_req, res) =>
    res.json(res.locals.operator),
  );
  app.use("/api/timetables", timetables(db));
  app.use("/api/rooms", crud(schemas.rooms, db.room));
  app.use("/api/time-slots", crud(schemas["time-slots"], db.timeSlot));
  app.use(
    "/api/faculty-availability",
    crud(schemas["faculty-availability"], db.facultyAvailability),
  );
  app.use(
    "/api/academic-years",
    crud(schemas["academic-years"], db.academicYear),
  );
  app.use("/api/semesters", crud(schemas.semesters, db.semester));
  app.use("/api/sections", crud(schemas.sections, db.section));
  app.use(
    "/api/student-groups",
    crud(schemas["student-groups"], db.studentGroup),
  );
  app.use("/api/subjects", crud(schemas.subjects, db.subject));
  app.use(
    "/api/weekly-requirements",
    crud(schemas["weekly-requirements"], db.weeklyRequirement),
  );
  app.use("/api/faculty", crud(schemas.faculty, db.faculty));
  app.use(
    "/api/faculty-eligibility",
    crud(schemas["faculty-eligibility"], db.facultySubjectEligibility),
  );
  app.use(
    "/api/teaching-allocations",
    crud(schemas["teaching-allocations"], db.teachingAllocation),
  );
  app.use((_req, res) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } });
  });
  app.use(handleError);
  return app;
}
