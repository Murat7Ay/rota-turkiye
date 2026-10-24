// Gerçek bölge paketiyle uçtan uca planlama denemesi (ağ yok, düz çizgi rota).
// Kullanım: pnpm --filter @rota/data smoke [ege|kapadokya|istanbul-tarihi]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CATEGORIES,
  availableWindows,
  buildBriefing,
  buildPlaceIndex,
  createTravelModel,
  findCorridorDiscoveries,
  formatHHmm,
  planTrip,
  repairDay,
  weekdayOf,
  type RegionPack,
  type TransportMode,
  type TripRequest,
} from "@rota/core";
import { fold } from "./text";

interface Scenario {
  start: string;
  stays: Array<[string, number]>;
  startDate: string;
  transport: TransportMode;
  interests: TripRequest["interests"];
}

// İstanbul senaryosu bir salıyı kapsar: "Topkapı salı kapalı" kuralı gerçek veride de denetlenir.
const SCENARIOS: Record<string, Scenario> = {
  ege: { start: "İzmir", stays: [["İzmir", 1], ["Selçuk", 1], ["Pamukkale", 1]], startDate: "2026-10-31", transport: "araba", interests: ["tarih", "yemek", "tatli"] },
  kapadokya: { start: "Göreme", stays: [["Göreme", 2], ["Ürgüp", 1]], startDate: "2026-11-06", transport: "araba", interests: ["tarih", "doga", "fotograf", "yemek"] },
  "istanbul-tarihi": { start: "Sultanahmet", stays: [["Sultanahmet", 2], ["Kadıköy", 1]], startDate: "2026-11-02", transport: "toplu", interests: ["tarih", "kultur", "yemek", "tatli"] },
};

const id = process.argv[2] ?? "ege";
const sc = SCENARIOS[id];
if (!sc) throw new Error(`Senaryo yok: ${id}`);
const packPath = fileURLToPath(new URL(`../../../apps/web/public/packs/${id}.json`, import.meta.url));
const pack = JSON.parse(readFileSync(packPath, "utf8")) as RegionPack;
const town = (n: string) => {
  const t = pack.towns.find((x) => fold(x.name) === fold(n)) ?? pack.towns.find((x) => fold(x.name).startsWith(fold(n)));
  if (!t) throw new Error(`kasaba yok: ${n} (ilk 30: ${pack.towns.slice(0, 30).map((x) => x.name).join(", ")})`);
  return t;
};

const start = town(sc.start);
const req: TripRequest = {
  title: `${pack.name} duman testi`,
  startDate: sc.startDate,
  start: { name: start.name, loc: start.loc },
  stays: sc.stays.map(([n, nights]) => {
    const t = town(n);
    return { id: t.id, name: t.name, loc: t.loc, nights };
  }),
  travelers: 2,
  pace: "dengeli",
  interests: sc.interests,
  budget: { amount: 30000, currency: "TRY" },
  transport: sc.transport,
  dayStart: "08:30",
  dayEnd: "22:00",
  diet: {},
  visitor: "yerli",
};

let t0 = performance.now();
const index = buildPlaceIndex(pack.places);
const ctx = { index, travel: createTravelModel(sc.transport), seed: 42 };
console.log(`${pack.name}: ${pack.places.length} yer, ${pack.towns.length} yerleşim; indeks ${(performance.now() - t0).toFixed(0)} ms`);

t0 = performance.now();
const plan = planTrip(req, pack, ctx);
console.log(`planTrip: ${(performance.now() - t0).toFixed(0)} ms, tahmini toplam ${plan.estTotal} TL\n`);

const problems: string[] = [];
for (const d of plan.days) {
  console.log(`— ${d.index + 1}. gün ${d.date} (${["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][weekdayOf(d.date)]}) · ${d.from.name} → ${d.to.name}${d.isTravelDay ? " (yol)" : ""} · ~${d.estCost} TL`);
  for (const s of d.stops) {
    const p = index.get(s.placeId);
    console.log(`  ${formatHHmm(s.arriveMin)} ${s.slot.padEnd(9)} ${p ? CATEGORIES[p.cat].emoji : "?"} ${p?.name ?? s.placeId}${s.discovered ? " ✨" : ""} · ${s.reasons.slice(0, 2).join(", ")}`);
    // Sözleşme denetimi: her durak o günün açık penceresine sığmalı
    if (p && s.slot !== "konaklama" && !availableWindows(p, d.date).some(([a, b]) => s.arriveMin >= a && s.departMin <= b)) {
      problems.push(`${d.date} ${p.name}: açık pencere dışında (${formatHHmm(s.arriveMin)}–${formatHHmm(s.departMin)})`);
    }
  }
  if (d.warnings.length) console.log(`  ⚠ ${d.warnings.length} uyarı`);
}

const travel = plan.days.find((d) => d.isTravelDay && d.route);
if (travel?.route) {
  const disc = findCorridorDiscoveries(travel.route, { interests: req.interests, mode: sc.transport }, ctx);
  console.log(`\nyol üstü (${travel.from.name} → ${travel.to.name}): ${disc.slice(0, 6).map((x) => `${x.place.name} [${x.reason}]`).join(" | ") || "—"}`);
}

const b = buildBriefing(plan, 0, { index });
console.log(`\nbrifing: ${b.title}\nbildirim: ${b.notification.body}`);

const lunch = plan.days[0]!.stops.find((s) => s.slot === "ogle");
if (lunch) {
  t0 = performance.now();
  const opts = repairDay(plan, 0, { type: "skip", stopId: lunch.id }, { nowMin: lunch.arriveMin - 10 }, ctx);
  console.log(`\nonarım (öğle atlandı): ${(performance.now() - t0).toFixed(0)} ms → ${opts.map((o) => o.label).join(" | ")}`);
}

console.log(problems.length ? `\n❌ ${problems.length} sorun:\n  ${problems.join("\n  ")}` : "\n✓ Bütün duraklar açık pencerelerinde");
if (problems.length) process.exitCode = 1;
