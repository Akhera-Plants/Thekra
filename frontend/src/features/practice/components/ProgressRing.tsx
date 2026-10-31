interface ProgressRingProps {
  /** 0 → 1. */
  fraction: number;
  label: string;
  children?: React.ReactNode;
}

const SIZE = 200;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A calm ring that fills as time passes. The fill moves smoothly only when motion is allowed (`motion-safe`); with
 * reduced motion it steps once a second without any transition. Colours are theme tokens.
 */
export function ProgressRing({ fraction, label, children }: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <div className="relative flex size-[200px] items-center justify-center" role="img" aria-label={label}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 -rotate-90 rtl:scale-x-[-1]" aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-border" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
          className="stroke-primary motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-linear"
        />
      </svg>
      <div className="relative flex flex-col items-center gap-1 text-center">{children}</div>
    </div>
  );
}
