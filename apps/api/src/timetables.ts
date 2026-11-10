import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client.js";
import { id } from "./schemas.js";
import {
  timetableCatalog,
  timetableDisplay,
  validateTimetable,
} from "./timetable-validation.js";

const revision = { versionId: id, revision: z.int().nonnegative() };
const command = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("create") }),
  z.strictObject({
    action: z.literal("save"),
    ...revision,
    entryId: id.optional(),
    placement: z.strictObject({ allocationId: id, timeSlotId: id, roomId: id }),
  }),
  z.strictObject({ action: z.literal("remove"), ...revision, entryId: id }),
  z.strictObject({ action: z.literal("validate"), ...revision }),
  z.strictObject({ action: z.literal("publish"), ...revision }),
]);
const summary = {
  id: true,
  status: true,
  revision: true,
  number: true,
  publishedAt: true,
  publishedBy: true,
} as const;

export function timetables(db: PrismaClient) {
  const router = Router();

  router.get("/:yearId", async (req, res) => {
    const academicYearId = id.parse(req.params.yearId);
    const versionId = id.optional().parse(req.query.versionId);
    const signedIn = Boolean(res.locals.operator);
    const result = await db.$transaction(
      async (tx) => {
        const catalog = await timetableCatalog(tx, academicYearId);
        const versions = await tx.timetableVersion.findMany({
          where: {
            academicYearId,
            ...(signedIn ? {} : { status: "PUBLISHED" }),
          },
          orderBy: [{ number: { sort: "desc", nulls: "first" } }],
          select: summary,
        });
        const version = versionId
          ? versions.find((record) => record.id === versionId)
          : versions[0];
        if (versionId && !version) return null;
        const display =
          version?.status === "PUBLISHED"
            ? (
                await tx.timetableVersion.findUniqueOrThrow({
                  where: { id: version.id },
                  select: { snapshot: true },
                })
              ).snapshot
            : timetableDisplay(
                catalog,
                version
                  ? await tx.timetableEntry.findMany({
                      where: { versionId: version.id },
                      orderBy: { id: "asc" },
                    })
                  : [],
              );
        return { versions, version: version ?? null, display };
      },
      { isolationLevel: "RepeatableRead" },
    );
    if (!result) {
      res
        .status(404)
        .json({ error: { message: "Timetable version not found." } });
      return;
    }
    res.json(result);
  });

  router.post("/:yearId", async (req, res) => {
    const academicYearId = id.parse(req.params.yearId);
    const input = command.parse(req.body);
    const operator = res.locals.operator;
    if (input.action === "publish" && !operator.publish) {
      res.status(403).json({
        error: { message: "Your operator key cannot publish timetables." },
      });
      return;
    }
    const result = await db.$transaction(
      async (tx) => {
        const where = { academicYearId };
        const latest = () =>
          tx.timetableVersion.findFirst({
            where: { ...where, status: "PUBLISHED" },
            orderBy: { number: "desc" },
            include: { entries: true },
          });
        const working = await tx.timetableVersion.findFirst({
          where: { ...where, status: { not: "PUBLISHED" } },
          include: { entries: true },
        });
        if (input.action === "create") {
          if (working)
            return {
              status: 409,
              error: {
                message: "This academic year already has a working draft.",
              },
            };
          const published = await latest();
          const version = await tx.timetableVersion.create({
            data: {
              academicYearId,
              entries: {
                createMany: {
                  data:
                    published?.entries.map(
                      ({ allocationId, timeSlotId, roomId }) => ({
                        allocationId,
                        timeSlotId,
                        roomId,
                      }),
                    ) ?? [],
                },
              },
            },
            select: summary,
          });
          return { status: 201, version };
        }
        if (
          !working ||
          working.id !== input.versionId ||
          working.revision !== input.revision
        ) {
          return {
            status: 409,
            error: {
              message:
                "This revision is stale or published. Reload before changing the timetable.",
            },
          };
        }
        if (input.action === "publish" && working.status !== "VALIDATED") {
          return {
            status: 409,
            error: { message: "Validate this revision before publishing." },
          };
        }
        if (
          (input.action === "save" || input.action === "remove") &&
          input.entryId &&
          !working.entries.some((entry) => entry.id === input.entryId)
        ) {
          return {
            status: 404,
            error: { message: "The session was not found in this draft." },
          };
        }

        const catalog = await timetableCatalog(tx, academicYearId);
        const nextRevision = { revision: { increment: 1 } } as const;
        const versionWhere = {
          id: working.id,
          revision: working.revision,
          status: working.status,
        };

        if (input.action === "save" || input.action === "remove") {
          if (input.action === "save") {
            const candidate = {
              id: input.entryId ?? randomUUID(),
              ...input.placement,
            };
            const entries = working.entries.filter(
              (entry) => entry.id !== candidate.id,
            );
            const issues = validateTimetable(
              catalog,
              [...entries, candidate],
              false,
            ).filter((issue) => issue.entries.includes(candidate.id));
            if (issues.length)
              return {
                status: 422,
                error: { message: "This session cannot be saved.", issues },
              };
            await tx.timetableEntry.upsert({
              where: { id: candidate.id },
              create: { ...candidate, versionId: working.id },
              update: input.placement,
            });
          } else {
            await tx.timetableEntry.delete({
              where: { id: input.entryId, versionId: working.id },
            });
          }
          const version = await tx.timetableVersion.update({
            where: versionWhere,
            data: { ...nextRevision, status: "DRAFT" },
            select: summary,
          });
          return { status: 200, version };
        }

        const issues = validateTimetable(catalog, working.entries, true);
        if (issues.length)
          return {
            status: 422,
            error: {
              message: "Resolve the timetable validation issues.",
              issues,
            },
          };

        const data =
          input.action === "publish"
            ? {
                status: "PUBLISHED" as const,
                number: ((await latest())?.number ?? 0) + 1,
                publishedAt: new Date(),
                publishedBy: operator.id as string,
                snapshot: timetableDisplay(catalog, working.entries),
              }
            : { status: "VALIDATED" as const };
        const version = await tx.timetableVersion.update({
          where: versionWhere,
          data: { ...nextRevision, ...data },
          select: summary,
        });
        return { status: 200, version };
      },
      { isolationLevel: "Serializable" },
    );
    const { status, ...body } = result;
    res.status(status).json(body);
  });

  return router;
}
