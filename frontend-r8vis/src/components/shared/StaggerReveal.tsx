import { Children, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const STAGGER_CAP = 6;
const STAGGER_STEP_MS = 50;

interface StaggerRevealProps {
  children: ReactNode;
  /** Applied to each item's reveal wrapper (layout utilities only, no colour). */
  className?: string;
}

/**
 * Wraps a static list of children so each one fades in and rises on mount
 * (design-system.mdc §3, design-language-sakina.md §Motion). Delay is staggered
 * ~50ms per item up to a cap of 6 — remaining items share the 6th item's delay,
 * so a long list never produces an unbounded stagger.
 *
 * Fully inert under `prefers-reduced-motion: reduce`: the animation utility is
 * gated behind `motion-safe:`, so reduced-motion users see children at their
 * final state immediately, with no JS branching needed.
 */
export function StaggerReveal({ children, className }: StaggerRevealProps) {
  return (
    <>
      {Children.map(children, (child, index) => {
        const delay = Math.min(index, STAGGER_CAP - 1) * STAGGER_STEP_MS;
        return (
          <div
            className={cn('motion-safe:animate-reveal-up', className)}
            style={{ animationDelay: `${delay}ms` }}
          >
            {child}
          </div>
        );
      })}
    </>
  );
}
