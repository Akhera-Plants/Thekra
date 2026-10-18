export function OrnamentalDivider() {
  return (
    <div className="ornamental-divider" aria-hidden>
      <span />
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative SVG asset */}
      <img src="/ornaments/section-ornament.svg" width={56} height={28} alt="" />
      <span />
    </div>
  );
}
