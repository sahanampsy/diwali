/** Slowly rotating rangoli-style mandala, drawn in thin gold lines. */
export function Mandala({ className = '' }: { className?: string }) {
  const petals = (n: number, r: number, len: number, w: number) =>
    Array.from({ length: n }, (_, i) => (
      <path
        key={`${r}-${i}`}
        d={`M0 ${-r} Q${w} ${-r - len / 2} 0 ${-r - len} Q${-w} ${-r - len / 2} 0 ${-r} Z`}
        transform={`rotate(${(360 / n) * i})`}
      />
    ));
  return (
    <svg className={`mandala ${className}`} viewBox="-200 -200 400 400" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="0.8">
        <circle r="30" />
        <circle r="34" strokeDasharray="2 4" />
        {petals(12, 34, 40, 12)}
        <circle r="82" />
        {petals(24, 82, 34, 7)}
        <circle r="122" strokeDasharray="1 5" />
        {petals(36, 124, 46, 6)}
        <circle r="176" />
        {Array.from({ length: 72 }, (_, i) => (
          <circle key={i} r="2" cx="0" cy="-186" transform={`rotate(${i * 5})`} />
        ))}
      </g>
    </svg>
  );
}
