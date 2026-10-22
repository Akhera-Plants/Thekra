-- Topic themes (prisma/taxonomy/topic-themes.yaml), written by import:taxonomy.
ALTER TABLE "SinQuote" ADD COLUMN "themeKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "GoodDeedQuote" ADD COLUMN "themeKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "SinQuote_themeKeys_idx" ON "SinQuote" USING GIN ("themeKeys");
CREATE INDEX "GoodDeedQuote_themeKeys_idx" ON "GoodDeedQuote" USING GIN ("themeKeys");
