-- A sunan tahqiq grade may be published. It is not a Sahihayn grade.
ALTER TYPE "GradeSource" ADD VALUE 'SUNAN_TAHQIQ';

-- Marks a published narration as outside the two Sahihs. Severity stays LOW, so the reader clause does not hide it.
ALTER TYPE "FlagType" ADD VALUE 'OUTSIDE_SAHIHAYN';
