-- CreateTable
CREATE TABLE "PracticeSettings" (
    "userId" TEXT NOT NULL,
    "hijriOffset" INTEGER NOT NULL DEFAULT 0,
    "reminderTimes" TEXT[],
    "freeMinutesPerDay" INTEGER,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "HabitPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "habitKey" TEXT,
    "deedSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "ceiling" DOUBLE PRECISION,
    "activeDaysPerWeek" INTEGER NOT NULL,
    "slots" TEXT[],
    "rule" JSONB,
    "createdOn" DATE NOT NULL,
    "amountChangedOn" DATE NOT NULL,
    "ebbSince" DATE,
    "season" JSONB,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HabitPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitLog" (
    "planId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HabitLog_pkey" PRIMARY KEY ("planId","date")
);

-- CreateTable
CREATE TABLE "Relative" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "rule" JSONB NOT NULL,
    "lastContactedOn" DATE,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Relative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelativeContact" (
    "relativeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelativeContact_pkey" PRIMARY KEY ("relativeId","date")
);

-- CreateTable
CREATE TABLE "SinVault" (
    "userId" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "kdf" TEXT NOT NULL,
    "iterations" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SinVault_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "HabitPlan_userId_updatedAt_idx" ON "HabitPlan"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Relative_userId_updatedAt_idx" ON "Relative"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "PracticeSettings" ADD CONSTRAINT "PracticeSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitPlan" ADD CONSTRAINT "HabitPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitLog" ADD CONSTRAINT "HabitLog_planId_fkey" FOREIGN KEY ("planId") REFERENCES "HabitPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relative" ADD CONSTRAINT "Relative_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelativeContact" ADD CONSTRAINT "RelativeContact_relativeId_fkey" FOREIGN KEY ("relativeId") REFERENCES "Relative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SinVault" ADD CONSTRAINT "SinVault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

