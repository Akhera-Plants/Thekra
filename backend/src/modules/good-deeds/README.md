# good-deeds module (placeholder)

This folder will hold the NestJS module for the "I want to do a good deed" side of the app: managing the
`GoodDeed` catalogue (name, `nameAr`, `slug`, category, description, `reward`, `rewardAr`) and resolving a
chosen deed into the content that motivates and rewards it through the `GoodDeedQuote` join table, ordered by
`relevanceScore`. It will also surface the optional link back to the sin a deed is the opposite of
(`GoodDeed.oppositeSin`). Nothing is implemented in this phase.
