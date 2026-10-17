'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { cn } from '@/lib/utils';
import type { SegmentTabsProps } from './types';
import { segmentListVariants, segmentTriggerVariants } from './variants';

/**
 * Segmented / underline tab strip on Radix Tabs.
 * Arrow keys and RTL are handled by Radix; counts use FormattedNumber when numeric.
 */
function SegmentTabs({
  items,
  value,
  onValueChange,
  variant = 'segment',
  size = 'hugged',
  className,
  listClassName,
  'aria-label': ariaLabel,
  children,
}: SegmentTabsProps) {
  const visible = items.filter((item) => !item.hidden);

  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      className={cn('w-full gap-0', className)}
    >
      <TabsList
        aria-label={ariaLabel}
        data-variant={variant}
        className={cn(
          segmentListVariants({ variant, size }),
          // Override the stock TabsList height/padding so our segment chrome wins.
          'h-auto w-full max-w-full justify-stretch rounded-xl p-0',
          variant === 'segment' && 'p-1.5',
          variant === 'underline' && 'rounded-none bg-transparent',
          size === 'hugged' && 'w-fit',
          listClassName,
        )}
      >
        {visible.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              segmentTriggerVariants({ variant, size }),
              // Stock trigger paints its own active surface — clear it for ours.
              'h-auto flex-none border-0 bg-transparent shadow-none data-active:shadow-sm',
              'dark:data-active:border-transparent dark:data-active:bg-background',
              size === 'filled' && 'flex-1',
            )}
          >
            <span>{item.label}</span>
            {item.count !== undefined && item.count !== null ? (
              <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                <span aria-hidden className="opacity-40">
                  ·
                </span>
                {typeof item.count === 'number' ? (
                  <FormattedNumber value={item.count} />
                ) : (
                  item.count
                )}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

export { SegmentTabs, TabsContent as SegmentTabsContent };
export type { SegmentTabsProps, SegmentTabItem, SegmentTabsVariant, SegmentTabsSize } from './types';
