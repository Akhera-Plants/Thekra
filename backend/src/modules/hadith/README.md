# hadith module (placeholder)

This folder will hold the NestJS module for Hadith content: reading `Quote` rows of type `HADITH`, exposing
them with their narrator (`narrator`, `narratorAr`), authenticity grade (`HadithGrade`: SAHIH, HASAN, DAIF,
MAWDU, UNGRADED), and book reference (`hadithReference`) joined to the `Source` collection they belong to. It
will also own grade-aware filtering, so that callers can require authentic narrations only. Ingestion from
external Hadith providers belongs to the `content-sync` module. Nothing is implemented in this phase.
