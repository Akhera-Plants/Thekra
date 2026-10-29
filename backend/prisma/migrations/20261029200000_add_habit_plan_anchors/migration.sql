-- Optional prayer anchors of a habit plan's reminder slots (practice-core PlanAnchor). Additive; old rows stay NULL.
ALTER TABLE "HabitPlan" ADD COLUMN "anchors" JSONB;
