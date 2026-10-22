# Frontend feature slices

Each subfolder is a placeholder for one feature slice of the web app, to be built in a later phase. For now
they hold nothing but a `README.md`: this phase ships structure only, so there are no components, pages,
hooks, stores, or API calls. When a slice is implemented it will own its own UI, its React Query hooks, and any
local Zustand state, while routes stay in `src/app` and the shared HTTP client lives in `src/lib`.
