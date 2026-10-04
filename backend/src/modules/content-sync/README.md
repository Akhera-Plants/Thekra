# content-sync module (placeholder)

This folder is where future background jobs will pull content from external Quran and Hadith APIs (for example
Quran.com / alquran.cloud for verses and Sunnah.com / HadithAPI for narrations) and cache it locally into the
`Quote`, `Source`, and `SyncLog` tables. Each remote provider is represented by a `Source` row with
`isExternalApi = true` plus its `apiProvider` / `apiBaseUrl`, imported quotes are stored with
`origin = API_CACHED` and keyed by the `(apiProvider, externalId)` unique pair so re-running an import is
idempotent, the untouched provider response can be kept in `rawPayload`, and every run is recorded in
`SyncLog` with its `SyncStatus`, timestamps, `recordsImported`, and `errorMessage`. The actual fetching,
scheduling, and retry behaviour are a later phase; nothing is implemented now.
