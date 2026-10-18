'use client';

import { Fragment, useEffect, useRef } from 'react';
import { cva } from 'class-variance-authority';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { cn } from '@/lib/utils';
import { formatCount } from './format';

export interface DataColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Width/alignment for both th and td (layout only). */
  className?: string;
}

export type RowTone = 'danger' | 'caution' | 'none';

export interface DataTableLabels {
  expand: string;
  collapse: string;
  empty: string;
  error: string;
  retry: string;
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  labels: DataTableLabels;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Row expansion («the opened folio»). */
  renderExpanded?: (row: T) => React.ReactNode;
  expandedKey?: string | null;
  onExpandedChange?: (key: string | null) => void;
  /** Keyboard cursor (j/k). Controlled so pages can act on the active row. */
  activeKey?: string | null;
  onActiveChange?: (key: string | null) => void;
  /** j/k/Enter/Esc on the document while no field has focus. */
  keyboard?: boolean;
  /** Status colour per row, drawn as a hairline at the row's start edge. */
  rowTone?: (row: T) => RowTone;
  skeletonRows?: number;
  footer?: React.ReactNode;
  caption?: string;
  className?: string;
}

/** The row's status colour: a 2px hairline on the start edge of its first cell. */
const edgeVariants = cva('border-s-2', {
  variants: {
    tone: { danger: 'border-s-destructive', caution: 'border-s-intent-good-deed/70', none: 'border-s-transparent' },
  },
  defaultVariants: { tone: 'none' },
});

const rowVariants = cva('group/row border-b border-border/70 text-sm', {
  variants: {
    active: { true: 'bg-muted/50', false: 'hover:bg-muted/30' },
    expanded: { true: 'bg-card border-transparent', false: '' },
  },
  defaultVariants: { active: false, expanded: false },
});

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || !!target.closest('[role="dialog"],[role="menu"],[role="listbox"]');
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  labels,
  isLoading,
  isError,
  onRetry,
  renderExpanded,
  expandedKey = null,
  onExpandedChange,
  activeKey = null,
  onActiveChange,
  keyboard = false,
  rowTone,
  skeletonRows = 10,
  footer,
  caption,
  className,
}: DataTableProps<T>) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const expandable = !!renderExpanded;
  const colCount = columns.length + (expandable ? 1 : 0);

  useEffect(() => {
    if (!keyboard || !onActiveChange) return;
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const keys = rows.map(rowKey);
      if (keys.length === 0) return;
      const index = activeKey ? keys.indexOf(activeKey) : -1;
      if (event.key === 'j' || event.key === 'k') {
        event.preventDefault();
        const next = event.key === 'j' ? Math.min(index + 1, keys.length - 1) : Math.max(index - 1, 0);
        onActiveChange?.(keys[next] ?? null);
      } else if (event.key === 'Enter' && activeKey && expandable) {
        event.preventDefault();
        onExpandedChange?.(expandedKey === activeKey ? null : activeKey);
      } else if (event.key === 'Escape' && expandedKey) {
        onExpandedChange?.(null);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [keyboard, rows, rowKey, activeKey, expandedKey, expandable, onActiveChange, onExpandedChange]);

  useEffect(() => {
    if (!activeKey) return;
    bodyRef.current
      ?.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(activeKey)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeKey]);

  const toggle = (key: string) => {
    onActiveChange?.(key);
    onExpandedChange?.(expandedKey === key ? null : key);
  };

  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <div className="relative w-full overflow-x-auto">
        <table className="w-full caption-bottom border-collapse">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b border-border">
              {expandable ? <th scope="col" className="w-9" aria-hidden /> : null}
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn('h-9 px-3 text-start align-middle text-xs font-medium whitespace-nowrap text-muted-foreground', column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {isLoading
              ? Array.from({ length: skeletonRows }).map((_, index) => (
                  <tr key={index} className="h-10 border-b border-border/70">
                    {Array.from({ length: colCount }).map((__, cell) => (
                      <td key={cell} className="px-3">
                        <Skeleton className={cn('h-3.5', cell === 0 && expandable ? 'w-3.5' : 'w-full max-w-48')} />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {!isLoading && isError ? (
              <tr>
                <td colSpan={colCount}>
                  <ErrorState message={labels.error} retryLabel={labels.retry} onRetry={onRetry} />
                </td>
              </tr>
            ) : null}
            {!isLoading && !isError && rows.length === 0 ? (
              <tr>
                <td colSpan={colCount}>
                  <EmptyState message={labels.empty} />
                </td>
              </tr>
            ) : null}
            {!isLoading && !isError
              ? rows.map((row) => {
                  const key = rowKey(row);
                  const isExpanded = expandedKey === key;
                  const edge = edgeVariants({ tone: rowTone?.(row) ?? 'none' });
                  return (
                    <Fragment key={key}>
                      <tr
                        data-row-key={key}
                        aria-selected={activeKey === key || undefined}
                        className={cn(
                          rowVariants({ active: activeKey === key, expanded: isExpanded }),
                          expandable && 'cursor-pointer',
                        )}
                        onClick={expandable ? (event) => {
                          if ((event.target as HTMLElement).closest('a,button,[role="menuitem"],input')) return;
                          toggle(key);
                        } : undefined}
                      >
                        {expandable ? (
                          <td className={cn('w-9 ps-1.5 align-middle', edge)}>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? labels.collapse : labels.expand}
                              onClick={() => toggle(key)}
                            >
                              <ChevronLeft
                                aria-hidden
                                className={cn(
                                  'transition-transform duration-150 ease-out motion-reduce:transition-none ltr:-scale-x-100',
                                  isExpanded && '-rotate-90 ltr:rotate-90',
                                )}
                              />
                            </Button>
                          </td>
                        ) : null}
                        {columns.map((column, index) => (
                          <td
                            key={column.id}
                            className={cn('h-10 px-3 py-1.5 align-middle', !expandable && index === 0 && edge, column.className)}
                          >
                            {column.cell(row)}
                          </td>
                        ))}
                      </tr>
                      {isExpanded && renderExpanded ? (
                        <tr className="border-b border-border bg-card">
                          <td colSpan={colCount} className="px-4 pt-1 pb-5 ps-12">
                            <div className="desk-folio">{renderExpanded(row)}</div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

export interface TablePagerProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  labels: { prev: string; next: string; page: (page: string, total: string) => string; rows: (count: string) => string };
  hint?: React.ReactNode;
}

/** Quiet footer: total on one side, page step on the other. */
export function TablePager({ page, totalPages, total, onPageChange, labels, hint }: TablePagerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span className="tabular-nums" aria-live="polite">{labels.rows(formatCount(total))}</span>
        {hint}
      </div>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            {labels.prev}
          </Button>
          <span className="tabular-nums">{labels.page(formatCount(page), formatCount(totalPages))}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            {labels.next}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
