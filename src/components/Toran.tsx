/** A swaying marigold garland strung across the top of the page. */
export function Toran() {
  const strands = 13;
  return (
    <div className="toran" aria-hidden="true">
      <svg viewBox="0 0 1200 90" preserveAspectRatio="none" className="toran-rope">
        <path d="M0 6 Q600 70 1200 6" stroke="#c9862c" strokeWidth="2" fill="none" />
      </svg>
      <div className="toran-strands">
        {Array.from({ length: strands }, (_, i) => {
          const len = 3 + ((i * 7) % 4);
          return (
            <div key={i} className="toran-strand" style={{ ['--i' as string]: i }}>
              {Array.from({ length: len }, (_, j) => (
                <span key={j} className={`bloom ${j % 2 ? 'bloom-yellow' : 'bloom-orange'}`} />
              ))}
              <span className="bloom-leaf" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
