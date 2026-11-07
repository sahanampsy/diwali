interface Props {
  size?: number;
  lit?: boolean;
  delay?: number;
  className?: string;
}

/** A clay diya with a flickering flame. */
export function Diya({ size = 64, lit = true, delay = 0, className = '' }: Props) {
  return (
    <svg
      className={`diya ${lit ? 'is-lit' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{ ['--d' as string]: `${delay}s` }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="diya-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd27a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ff9933" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="diya-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff6b2c" />
          <stop offset="55%" stopColor="#ffc24a" />
          <stop offset="100%" stopColor="#fff6d6" />
        </linearGradient>
        <linearGradient id="diya-clay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2763a" />
          <stop offset="100%" stopColor="#8f2f1c" />
        </linearGradient>
      </defs>
      {lit && <circle className="diya-halo" cx="32" cy="26" r="22" fill="url(#diya-glow)" />}
      {lit && (
        <path
          className="diya-flame"
          d="M32 8 C36 15 39 20 36 26 C34.5 29 29.5 29 28 26 C25 20 28 15 32 8 Z"
          fill="url(#diya-flame)"
        />
      )}
      <path d="M8 34 Q32 30 56 34 Q52 52 32 54 Q12 52 8 34 Z" fill="url(#diya-clay)" />
      <path d="M8 34 Q32 38 56 34" stroke="#ffcf7a" strokeWidth="1.6" fill="none" opacity="0.8" />
      <circle cx="20" cy="44" r="1.6" fill="#ffcf7a" opacity="0.8" />
      <circle cx="32" cy="46.5" r="1.6" fill="#ffcf7a" opacity="0.8" />
      <circle cx="44" cy="44" r="1.6" fill="#ffcf7a" opacity="0.8" />
    </svg>
  );
}
