import { cva } from 'class-variance-authority';
import { Check, CircleAlert, Minus, TriangleAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * «مسار النص» — the provenance ledger of one text:
 * المصدر → الباب → التخريج → الحكم → النشر.
 * Small labelled nodes on a hairline; the step that stops publication is inked red
 * and marked «هنا يتوقف». Data is passed in; this component never fetches.
 */

export type TrailState = 'ok' | 'warn' | 'fail' | 'na' | 'pending';

export interface TrailStep {
  id: string;
  label: string;
  value: React.ReactNode;
  state: TrailState;
  /** Short reason under the value, e.g. «نص مسح ضوئي غير مُراجَع». */
  note?: string;
}

export interface ProvenanceTrailLabels {
  title: string;
  failHere: string;
  states: Record<TrailState, string>;
}

export interface ProvenanceTrailProps {
  steps: TrailStep[];
  labels: ProvenanceTrailLabels;
  isLoading?: boolean;
  /** `row` sits inside a table expansion; `panel` gets a little more air. */
  density?: 'row' | 'panel';
  className?: string;
}

const nodeVariants = cva('flex min-w-0 flex-col gap-0.5 rounded-md border px-2.5 py-1.5', {
  variants: {
    state: {
      ok: 'border-border bg-background',
      warn: 'border-intent-good-deed/40 bg-intent-good-deed/5',
      fail: 'border-destructive/50 bg-destructive/10',
      na: 'border-dashed border-border bg-transparent text-muted-foreground',
      pending: 'border-border bg-background',
    },
  },
});

const STATE_ICON = {
  ok: { icon: Check, className: 'text-primary' },
  warn: { icon: TriangleAlert, className: 'text-intent-good-deed' },
  fail: { icon: CircleAlert, className: 'text-destructive' },
  na: { icon: Minus, className: 'text-muted-foreground' },
  pending: { icon: Minus, className: 'text-muted-foreground animate-pulse motion-reduce:animate-none' },
} as const satisfies Record<TrailState, { icon: React.ElementType; className: string }>;

export function ProvenanceTrail({
  steps,
  labels,
  isLoading,
  density = 'row',
  className,
}: ProvenanceTrailProps) {
  const firstFail = steps.findIndex((step) => step.state === 'fail');

  return (
    <section aria-label={labels.title} className={cn('flex flex-col gap-2', className)}>
      <h3 className="text-xs font-medium text-muted-foreground">{labels.title}</h3>
      {isLoading ? (
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-28 rounded-md" />
          ))}
        </div>
      ) : (
        <ol className={cn('flex flex-wrap items-stretch gap-y-2', density === 'panel' && 'gap-y-3')}>
          {steps.map((step, index) => {
            const { icon: Icon, className: iconClass } = STATE_ICON[step.state];
            return (
              <li key={step.id} className="flex min-w-0 items-center">
                {index > 0 ? <span aria-hidden className="h-px w-3 shrink-0 bg-border" /> : null}
                <div className={nodeVariants({ state: step.state })}>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon aria-hidden className={cn('size-3 shrink-0', iconClass)} />
                    {step.label}
                    <span className="sr-only">: {labels.states[step.state]}</span>
                    {index === firstFail ? (
                      <span className="ms-1 font-medium text-destructive">· {labels.failHere}</span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'max-w-64 truncate text-sm',
                      step.state === 'na' ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {step.value}
                  </span>
                  {step.note ? (
                    <span
                      className={cn(
                        'max-w-64 text-xs text-pretty',
                        step.state === 'fail' ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {step.note}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
