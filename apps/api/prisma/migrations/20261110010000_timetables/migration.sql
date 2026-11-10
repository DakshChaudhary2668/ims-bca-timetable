BEGIN;


-- CreateEnum
CREATE TYPE "TimetableStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED');

-- AlterTable
ALTER TABLE "AcademicYear" ADD COLUMN     "maxConsecutivePeriods" INTEGER;

-- AlterTable
ALTER TABLE "StudentGroup" ADD COLUMN     "wholeSection" BOOLEAN;

-- CreateTable
CREATE TABLE "TimetableVersion" (
    "id" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "status" "TimetableStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "number" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "snapshot" JSONB,

    CONSTRAINT "TimetableVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableEntry" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "allocationId" UUID NOT NULL,
    "timeSlotId" UUID NOT NULL,
    "roomId" UUID NOT NULL,

    CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimetableVersion_academicYearId_number_key" ON "TimetableVersion"("academicYearId", "number");

-- CreateIndex
CREATE INDEX "TimetableEntry_versionId_timeSlotId_idx" ON "TimetableEntry"("versionId", "timeSlotId");

-- AddForeignKey
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TimetableVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "TeachingAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_consecutive_limit"
    CHECK ("maxConsecutivePeriods" > 0);
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_publication_metadata"
    CHECK (
        ("status" = 'PUBLISHED' AND "number" IS NOT NULL AND "number" > 0 AND
         "publishedAt" IS NOT NULL AND "publishedBy" IS NOT NULL AND "snapshot" IS NOT NULL)
        OR ("status" <> 'PUBLISHED' AND "number" IS NULL AND
            "publishedAt" IS NULL AND "publishedBy" IS NULL AND "snapshot" IS NULL)
    );
CREATE UNIQUE INDEX "TimetableVersion_one_working_per_year"
    ON "TimetableVersion" ("academicYearId") WHERE "status" <> 'PUBLISHED';

CREATE FUNCTION protect_timetable_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP <> 'INSERT' AND OLD."status" = 'PUBLISHED' THEN
        RAISE EXCEPTION 'Published timetables are immutable' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    IF NEW."status" = 'PUBLISHED' AND (TG_OP = 'INSERT' OR OLD."status" <> 'VALIDATED') THEN
        RAISE EXCEPTION 'Publication requires a validated version' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "TimetableVersion_protect_publication"
    BEFORE INSERT OR UPDATE OR DELETE ON "TimetableVersion"
    FOR EACH ROW EXECUTE FUNCTION protect_timetable_version();

CREATE FUNCTION protect_timetable_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status "TimetableStatus";
BEGIN
    IF TG_OP = 'UPDATE' AND NEW."versionId" <> OLD."versionId" THEN
        RAISE EXCEPTION 'Entries cannot move between versions' USING ERRCODE = '23514';
    END IF;
    EXECUTE format('SELECT "status" FROM %I."TimetableVersion" WHERE "id" = $1 FOR SHARE', TG_TABLE_SCHEMA)
        INTO parent_status
        USING CASE WHEN TG_OP = 'INSERT' THEN NEW."versionId" ELSE OLD."versionId" END;
    IF parent_status = 'PUBLISHED' THEN
        RAISE EXCEPTION 'Published timetable entries are immutable' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "TimetableEntry_protect_publication"
    BEFORE INSERT OR UPDATE OR DELETE ON "TimetableEntry"
    FOR EACH ROW EXECUTE FUNCTION protect_timetable_entry();

COMMIT;
