-- HadeethEnc (موسوعة الأحاديث النبوية): publishable grade source + quote-attached
-- explanation kinds for sharh, fawaid, gharib, and long classical sharh.

ALTER TYPE "GradeSource" ADD VALUE IF NOT EXISTS 'HADEETHENC';

ALTER TYPE "ExplanationKind" ADD VALUE IF NOT EXISTS 'FAWAID';
ALTER TYPE "ExplanationKind" ADD VALUE IF NOT EXISTS 'GHARIB';
ALTER TYPE "ExplanationKind" ADD VALUE IF NOT EXISTS 'SHARH_LONG';
