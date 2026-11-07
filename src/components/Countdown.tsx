import { useNow } from '../lib/hooks';

export function Countdown({ to }: { to: string }) {
  const now = useNow(1000);
  const target = new Date(to).getTime();
  if (!to || Number.isNaN(target)) return null;
  let diff = Math.max(0, target - now);
  if (diff === 0) {
    return (
      <div className="countdown-live">
        <span className="pulse-dot" /> The party is ON. Get here!
      </div>
    );
  }
  const units: [string, number][] = [];
  const days = Math.floor(diff / 864e5);
  diff -= days * 864e5;
  const hours = Math.floor(diff / 36e5);
  diff -= hours * 36e5;
  const mins = Math.floor(diff / 6e4);
  const secs = Math.floor((diff - mins * 6e4) / 1000);
  units.push(['Days', days], ['Hours', hours], ['Mins', mins], ['Secs', secs]);
  return (
    <div className="countdown" role="timer" aria-label={`${days} days, ${hours} hours, ${mins} minutes to go`}>
      {units.map(([label, v]) => (
        <div className="countdown-unit" key={label}>
          <span className="countdown-num">{String(v).padStart(2, '0')}</span>
          <span className="countdown-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
