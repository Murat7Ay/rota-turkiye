// 81 il merkezinin nokta haritası. Kaba eşdikdörtgen izdüşüm; noktaların üstüne çizilen geniş
// daireler birleşip yaklaşık bir Türkiye silueti oluşturur (gerçek sınır değildir).
import { PROVINCES, TURKEY_BBOX } from "../../../../../packages/core/src/provinces";

const [MIN_LON, MIN_LAT, MAX_LON, MAX_LAT] = TURKEY_BBOX;
const KX = Math.cos((((MIN_LAT + MAX_LAT) / 2) * Math.PI) / 180);
const SCALE = 60;
const PAD = 26;
const W = Math.round((MAX_LON - MIN_LON) * KX * SCALE + PAD * 2);
const H = Math.round((MAX_LAT - MIN_LAT) * SCALE + PAD * 2);

const project = (lat: number, lon: number): [number, number] => [PAD + (lon - MIN_LON) * KX * SCALE, PAD + (MAX_LAT - lat) * SCALE];

const POINTS = PROVINCES.map((p) => ({ p, xy: project(p.loc.lat, p.loc.lon) }));

export function ProvinceDotMap({ visited, latest }: { visited: ReadonlySet<number>; latest?: number | null }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Türkiye il haritası: 81 ilden ${visited.size} il ziyaret edildi`}>
      <defs>
        <radialGradient id="pp-visited" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#C2410C" />
        </radialGradient>
      </defs>
      {/* siluet */}
      <g fill="#E8DCC7">
        {POINTS.map(({ p, xy }) => (
          <circle key={`b${p.plate}`} cx={xy[0]} cy={xy[1]} r={40} />
        ))}
      </g>
      <g fill="#F2E9DA">
        {POINTS.map(({ p, xy }) => (
          <circle key={`c${p.plate}`} cx={xy[0]} cy={xy[1]} r={30} />
        ))}
      </g>
      {/* iller */}
      {POINTS.map(({ p, xy }) => {
        const on = visited.has(p.plate);
        return (
          <g key={p.plate}>
            <title>{`${p.plate} · ${p.name}${on ? " ✓" : ""}`}</title>
            {on && <circle cx={xy[0]} cy={xy[1]} r={15} fill="#C2410C" opacity={0.16} />}
            <circle
              cx={xy[0]}
              cy={xy[1]}
              r={on ? 8.5 : 6}
              fill={on ? "url(#pp-visited)" : "#CDBFA8"}
              stroke={on ? "#FFF7ED" : "none"}
              strokeWidth={on ? 2.5 : 0}
            />
            {on && latest === p.plate && (
              <circle cx={xy[0]} cy={xy[1]} r={13} fill="none" stroke="#0E7490" strokeWidth={2.5} className="motion-reduce:hidden">
                <animate attributeName="r" values="11;19;11" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.2;1" dur="2.4s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}
