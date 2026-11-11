import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Small tabular fact beside the title, e.g. «٤٣٬١٩٠ نص». */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** The page's one <h1>. Display face, quiet description, actions at the end edge. */
export function PageHeader({ title, description, meta, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {meta ? <span className="text-sm text-muted-foreground tabular-nums">{meta}</span> : null}
        </div>
        {description ? (
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
