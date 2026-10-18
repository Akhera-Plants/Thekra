'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { StatusBadge, type StatusTone } from './StatusBadge';
import { formatCount } from './format';

export interface FilterOption {
  value: string;
  label: string;
  /** Faceted count under the other active filters. `undefined` = no count for this facet. */
  count?: number;
  tone?: StatusTone;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
  /** Single-select (the backend filters take one value per facet). `null` = any. */
  selected: string | null;
  onSelect: (value: string | null) => void;
  countsLoading?: boolean;
  countsError?: boolean;
  /** Hide options whose count is zero (long facets like books). The selected one always shows. */
  hideEmpty?: boolean;
}

export interface FilterRailProps {
  groups: FilterGroup[];
  labels: { title: string; any: string; clear: string; countError: string };
  onClearAll?: () => void;
  /** Free slot above the groups (search input). */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The left-hand (start-side) rail of a dense table: facets with live counts,
 * one value per facet, «الكل» resets. Counts are tabular so columns of numbers align.
 */
export function FilterRail({ groups, labels, onClearAll, children, className }: FilterRailProps) {
  const anyActive = groups.some((group) => group.selected !== null);

  return (
    <aside
      aria-label={labels.title}
      className={cn('flex w-60 shrink-0 flex-col gap-5 border-e border-border pe-4', className)}
    >
      <div className="flex h-7 items-center justify-between">
        <h2 className="text-sm font-medium">{labels.title}</h2>
        {onClearAll && anyActive ? (
          <Button variant="ghost" size="xs" onClick={onClearAll}>
            {labels.clear}
          </Button>
        ) : null}
      </div>
      {children}
      {groups.map((group) => (
        <FacetGroup key={group.id} group={group} labels={labels} />
      ))}
    </aside>
  );
}

function FacetGroup({ group, labels }: { group: FilterGroup; labels: FilterRailProps['labels'] }) {
  const options = group.hideEmpty
    ? group.options.filter((option) => option.count !== 0 || option.value === group.selected)
    : group.options;

  return (
    <fieldset className="flex min-w-0 flex-col gap-0.5">
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{group.label}</legend>
      <FacetOption
        label={labels.any}
        active={group.selected === null}
        onClick={() => group.onSelect(null)}
      />
      {options.map((option) => (
        <FacetOption
          key={option.value}
          label={option.label}
          tone={option.tone}
          active={group.selected === option.value}
          onClick={() => group.onSelect(group.selected === option.value ? null : option.value)}
          count={
            group.countsError ? (
              <span title={labels.countError}>—</span>
            ) : group.countsLoading && option.count === undefined ? (
              <Skeleton className="h-3 w-8" />
            ) : option.count !== undefined ? (
              formatCount(option.count)
            ) : null
          }
        />
      ))}
    </fieldset>
  );
}

function FacetOption({
  label,
  tone,
  active,
  count,
  onClick,
}: {
  label: string;
  tone?: StatusTone;
  active: boolean;
  count?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'desk-press flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-start text-sm outline-none',
        'hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-muted font-medium text-foreground' : 'text-foreground/85',
      )}
    >
      <Check aria-hidden className={cn('size-3.5 shrink-0 text-primary', !active && 'invisible')} />
      <span className="min-w-0 flex-1 truncate">
        {tone ? <StatusBadge label={label} tone={tone} size="md" className="font-normal" /> : label}
      </span>
      {count !== null && count !== undefined ? (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{count}</span>
      ) : null}
    </button>
  );
}
