BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "regularDailyClasses" INTEGER NOT NULL DEFAULT 3,
    "maxTotalDailyPeriods" INTEGER,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semester" (
    "id" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "number" INTEGER NOT NULL,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGroup" (
    "id" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "StudentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyRequirement" (
    "id" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "sectionId" UUID,
    "lectureCount" INTEGER NOT NULL,

    CONSTRAINT "WeeklyRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faculty" (
    "id" UUID NOT NULL,
    "facultyCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultySubjectEligibility" (
    "id" UUID NOT NULL,
    "facultyId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,

    CONSTRAINT "FacultySubjectEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingAllocation" (
    "id" UUID NOT NULL,
    "facultyId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "studentGroupId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,

    CONSTRAINT "TeachingAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSlot" (
    "id" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startsAtMinute" INTEGER NOT NULL,
    "endsAtMinute" INTEGER NOT NULL,
    "protectedBreak" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultyAvailability" (
    "id" UUID NOT NULL,
    "facultyId" UUID NOT NULL,
    "timeSlotId" UUID NOT NULL,
    "available" BOOLEAN NOT NULL,

    CONSTRAINT "FacultyAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_name_key" ON "AcademicYear"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_academicYearId_number_key" ON "Semester"("academicYearId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Section_semesterId_name_key" ON "Section"("semesterId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Section_id_semesterId_key" ON "Section"("id", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGroup_sectionId_name_key" ON "StudentGroup"("sectionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGroup_id_semesterId_key" ON "StudentGroup"("id", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_semesterId_code_key" ON "Subject"("semesterId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_id_semesterId_key" ON "Subject"("id", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyRequirement_subjectId_sectionId_key" ON "WeeklyRequirement"("subjectId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_facultyCode_key" ON "Faculty"("facultyCode");

-- CreateIndex
CREATE UNIQUE INDEX "FacultySubjectEligibility_facultyId_subjectId_key" ON "FacultySubjectEligibility"("facultyId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAllocation_facultyId_subjectId_studentGroupId_key" ON "TeachingAllocation"("facultyId", "subjectId", "studentGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TimeSlot_academicYearId_weekday_startsAtMinute_key" ON "TimeSlot"("academicYearId", "weekday", "startsAtMinute");

-- CreateIndex
CREATE UNIQUE INDEX "FacultyAvailability_facultyId_timeSlotId_key" ON "FacultyAvailability"("facultyId", "timeSlotId");

-- AddForeignKey
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGroup" ADD CONSTRAINT "StudentGroup_sectionId_semesterId_fkey" FOREIGN KEY ("sectionId", "semesterId") REFERENCES "Section"("id", "semesterId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyRequirement" ADD CONSTRAINT "WeeklyRequirement_subjectId_semesterId_fkey" FOREIGN KEY ("subjectId", "semesterId") REFERENCES "Subject"("id", "semesterId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "WeeklyRequirement" ADD CONSTRAINT "WeeklyRequirement_sectionId_semesterId_fkey" FOREIGN KEY ("sectionId", "semesterId") REFERENCES "Section"("id", "semesterId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FacultySubjectEligibility" ADD CONSTRAINT "FacultySubjectEligibility_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultySubjectEligibility" ADD CONSTRAINT "FacultySubjectEligibility_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAllocation" ADD CONSTRAINT "TeachingAllocation_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAllocation" ADD CONSTRAINT "TeachingAllocation_subjectId_semesterId_fkey" FOREIGN KEY ("subjectId", "semesterId") REFERENCES "Subject"("id", "semesterId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "TeachingAllocation" ADD CONSTRAINT "TeachingAllocation_studentGroupId_semesterId_fkey" FOREIGN KEY ("studentGroupId", "semesterId") REFERENCES "StudentGroup"("id", "semesterId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultyAvailability" ADD CONSTRAINT "FacultyAvailability_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultyAvailability" ADD CONSTRAINT "FacultyAvailability_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add constraints Prisma cannot express.
ALTER TABLE "AcademicYear"
    ADD CONSTRAINT "AcademicYear_ordered_dates" CHECK ("startsOn" <= "endsOn"),
    ADD CONSTRAINT "AcademicYear_daily_limits" CHECK ("regularDailyClasses" >= 0 AND
        ("maxTotalDailyPeriods" IS NULL OR
         ("maxTotalDailyPeriods" > 0 AND "maxTotalDailyPeriods" >= "regularDailyClasses")));
ALTER TABLE "Semester"
    ADD CONSTRAINT "Semester_number_range" CHECK ("number" BETWEEN 1 AND 6);
ALTER TABLE "WeeklyRequirement"
    ADD CONSTRAINT "WeeklyRequirement_nonnegative_count" CHECK ("lectureCount" >= 0);
CREATE UNIQUE INDEX "WeeklyRequirement_subject_default_key"
    ON "WeeklyRequirement" ("subjectId") WHERE "sectionId" IS NULL;

CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "TimeSlot"
    ADD CONSTRAINT "TimeSlot_valid_interval" CHECK (
        "weekday" BETWEEN 1 AND 7 AND "startsAtMinute" >= 0 AND
        "startsAtMinute" < "endsAtMinute" AND "endsAtMinute" <= 1440),
    ADD CONSTRAINT "TimeSlot_no_overlap" EXCLUDE USING gist (
        "academicYearId" WITH =,
        "weekday" WITH =,
        int4range("startsAtMinute", "endsAtMinute", '[)') WITH &&
    );

COMMIT;
