import type { ReactNode } from 'react';

const SPAN_RE = /(\{[^}]+\}|﴿[^﴾]+﴾)/g;

/** Colour Quranic spans ({…} and ﴿…﴾) in the Quran face. */
export function renderExplanationText(text: string): ReactNode[] {
  const parts = text.split(SPAN_RE);
  return parts.map((part, index) => {
    if (!part) return null;
    if (
      (part.startsWith('{') && part.endsWith('}'))
      || (part.startsWith('﴿') && part.endsWith('﴾'))
    ) {
      const inner = part.slice(1, -1);
      return (
        <span key={index} className="font-quran text-primary">
          {inner}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
