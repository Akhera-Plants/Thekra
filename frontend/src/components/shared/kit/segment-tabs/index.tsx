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
  controls,
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
        className={cn(segmentListVariants({ variant, size }), listClassName)}
      >
        {visible.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            {...(controls ? { 'aria-controls': controls } : {})}
            className={segmentTriggerVariants({ variant, size })}
          >
            <span className="leading-none">{item.label}</span>
            {item.count !== undefined && item.count !== null ? (
              <span className="leading-none text-xs tabular-nums text-current/55">
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
