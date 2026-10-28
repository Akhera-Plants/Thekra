-- CreateTable
CREATE TABLE "UserPracticeStore" (
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPracticeStore_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserPracticeStore" ADD CONSTRAINT "UserPracticeStore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
