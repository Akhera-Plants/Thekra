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
