/**
 * The three door illustrations of the home (owner round 6, C-06: «خذ الرسومات … وحطها بالموقع»): a leaf for «أعنّي
 * على فعل طاعة», an arch-door for «تخفّف من ذنب», an open book for «شعب الإيمان». Line drawings from the reference
 * preview's home, one style and one scale (viewBox 240×260), drawn in `currentColor` so each card tints them with its
 * own token. Decorative only: inside the cards, behind the text, never a page background.
 */
export type DoorArtKind = 'leaf' | 'arch' | 'book';

export function DoorArt({ kind, className }: { kind: DoorArtKind; className?: string }) {
  return (
    <svg viewBox="0 0 240 260" fill="none" aria-hidden focusable="false" className={className}>
      {kind === 'leaf' ? (
        <g stroke="currentColor" strokeWidth="1.2">
          <path d="M110 258c13-50 10-117 45-195M123 189c-56-7-73-41-59-79 36 1 61 30 59 79ZM132 156c47-7 77-37 66-75-37 2-65 30-66 75ZM142 111c-33-18-40-52-20-78 25 11 32 39 20 78ZM155 63c-3-28 9-48 31-53 8 26-7 48-31 53Z" />
          <path d="M66 112c20 26 39 52 57 77M132 156c19-25 40-49 66-75M123 34c8 27 15 53 19 77M155 63l31-53" opacity=".65" />
        </g>
      ) : kind === 'arch' ? (
        <g stroke="currentColor" strokeWidth="1.1">
          <path d="M48 258V112a71 71 0 0 1 142 0v146M60 258V112a59 59 0 0 1 118 0v146M74 258V116a45 45 0 0 1 90 0v142M74 116l56-24v166M130 144l-8 3M25 258h184M119 30V17M33 110H17M207 110h16" />
          <path d="m168 233 35-20m-29 35 42-13M36 56l-9-11m168 11 10-11" opacity=".6" />
        </g>
      ) : (
        <g stroke="currentColor" strokeWidth="1.1">
          <path d="M39 185c24-11 53-6 79 11 26-17 55-22 81-11V73c-26-8-53-1-81 16-28-17-55-24-79-16v112ZM118 89v107M27 81v116c31-8 60-2 91 16 31-18 60-24 93-16V81M53 90q24-4 49 11m-49 2q24-4 49 11m-49 2q24-4 49 11m-49 2q24-4 49 11m-49 2q24-4 49 11m-49 2q24-4 49 11m33-66q26-15 50-11m-50 24q26-15 50-11m-50 24q26-15 50-11m-50 24q26-15 50-11m-50 24q26-15 50-11" />
          <path d="M118 54V26m-14 14h28M60 44l6-13m109 13-6-13M47 228q70-13 142 0" opacity=".5" />
        </g>
      )}
    </svg>
  );
}
