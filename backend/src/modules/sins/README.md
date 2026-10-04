# sins module (placeholder)

This folder will hold the NestJS module for the "I feel tempted to commit a sin" side of the app: managing the
`Sin` catalogue (name, `nameAr`, `slug`, category, description, `severity`) and resolving a chosen sin into the
reminders that discourage it by reading the `SinQuote` join table, ordered by `relevanceScore`. It will also
expose the relation between a sin and its opposite good deeds (`Sin.relatedGoodDeeds`), so a user can be moved
from avoiding a sin to performing its counterpart. Nothing is implemented in this phase.
