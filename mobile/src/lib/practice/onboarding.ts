/**
 * The first-run steps after sign-up (owner round 5, F-26 a) are shown once per device: the flag lives in its own
 * AsyncStorage key (not in the synced store: a member who signs up on a second device has already seen them, and the
 * register screen only offers them right after a new account; `onboarding-flag.ts`). Pure.
 */

/** «ماذا تريد الآن؟» */
export type OnboardingGoal = 'deed' | 'sin' | 'read';
export type OnboardingStep = 'goal' | 'pick' | 'time';

/**
 * The step after `step` for the chosen goal, or `done` (then the caller finishes): «القراءة فقط» ends after the
 * first step; a deed asks for the habit, then the time; leaving a sin skips the habit list (nothing is named here).
 */
export function onboardingNext(step: OnboardingStep, goal: OnboardingGoal | null): OnboardingStep | 'done' {
  if (step === 'goal') return goal === null || goal === 'read' ? 'done' : goal === 'deed' ? 'pick' : 'time';
  if (step === 'pick') return 'time';
  return 'done';
}

/** Where the member lands when the steps end: «عاداتي › ورد اليوم» with the new habit, «تخفَّف», or home. */
export function onboardingLanding(goal: OnboardingGoal | null, created: boolean): '/habits' | '/practice/sin-program' | '/' {
  if (goal === 'sin') return '/practice/sin-program';
  if (goal === 'deed' && created) return '/habits';
  return '/';
}
