import type * as React from 'react';

export type SegmentTabsVariant = 'segment' | 'underline';
export type SegmentTabsSize = 'hugged' | 'filled';

export interface SegmentTabItem {
  value: string;
  label: string;
  /** Optional count shown after the label (formatted by the caller). */
  count?: number | string;
  disabled?: boolean;
  hidden?: boolean;
}

export interface SegmentTabsProps {
  /**
   * id of the element the tabs filter. Without it Radix points each tab at a TabsContent panel,
   * which a strip used as a filter does not render (an aria-controls to nothing).
   */
  controls?: string;
  items: SegmentTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  variant?: SegmentTabsVariant;
  size?: SegmentTabsSize;
  className?: string;
  listClassName?: string;
  'aria-label'?: string;
  children?: React.ReactNode;
}
