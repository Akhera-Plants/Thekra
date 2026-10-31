-- Phase 4 (redesign §4.4): each browser's notification switches («التنبيهات»), sent with the subscription.
-- Additive and nullable: existing browsers keep the practice-core defaults.
ALTER TABLE "PushSubscription" ADD COLUMN "prefs" JSONB;
