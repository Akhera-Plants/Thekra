# classification module (placeholder)

This folder will hold the logic that connects content to intent: deciding which `Quote` rows belong to which
`Sin` or `GoodDeed`, writing and maintaining the `SinQuote` / `GoodDeedQuote` links with their
`relevanceScore` and `note`, and managing the `Tag` / `QuoteTag` vocabulary across its `TagCategory` values
(SIN, GOOD_DEED, THEME, EMOTION). Classification is expected to be a mix of curated/manual mapping and
assisted suggestion over newly ingested quotes, with human review before a link is trusted. Nothing is
implemented in this phase.
