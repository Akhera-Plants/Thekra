import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ActionPairProps extends React.ComponentProps<'div'> {
  /**
   * `fill` (default): the two actions share the row equally (two columns of the same width).
   * `hug`: side by side at the start edge (cards, list rows), each at least 8.5rem wide, so two short labels come out the
   * same size (O-02/W-03: «التفسير» + «عرض كامل»); a longer label keeps its own width rather than overflow a phone.
   */
  layout?: 'fill' | 'hug';
}

/**
 * Two related actions as one unit (owner round 5, O-02/W-03): side by side, the same 44px height, in one container.
 * The more important one is solid, the other outline; order in the DOM is the reading order (primary first).
 * The row only wraps when the two labels cannot fit beside each other (a very narrow phone, long English text):
 * each action then takes the full width, still the same height.
 *
 * Use it for: «التفسير/الشرح» + «عرض كامل» on a text card, «اشترك في التقويم» + «نزّل ملف التقويم», «زامن الآن» +
 * «حسابك وبياناتك», a dialog's confirm + cancel.
 */
export function ActionPair({ layout = 'fill', className, children, ...props }: ActionPairProps) {
  return (
    <div
      data-slot="action-pair"
      data-layout={layout}
      className={cn(
        layout === 'fill'
          ? // Equal columns; a column never narrower than 8.5rem, so two long labels wrap to one per row.
            'grid w-full gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,8.5rem),1fr))] [&>*]:w-full'
          : 'flex flex-wrap items-center gap-2 [&>*]:min-w-34',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
