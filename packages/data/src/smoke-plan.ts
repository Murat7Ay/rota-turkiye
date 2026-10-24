// Gerçek bölge paketiyle uçtan uca planlama denemesi (ağ yok, düz çizgi rota).
// Kullanım: pnpm --filter @rota/data exec tsx src/smoke-plan.ts [paket-id]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CATEGORIES,
  buildBriefing,
  buildPlaceIndex,
  createTravelModel,
  findCorridorDiscoveries,
  formatHHmm,
  planTrip,
  repairDay,
  type RegionPack,
  type TripRequest,
} from "@rota/core";

const id = process.argv[2] ?? "ege";
const packPath = fileURLToPath(new URL(`../../../apps/web/public/packs/${id}.json`, import.meta.url));
const pack = JSON.parse(readFileSync(packPath, "utf8")) as RegionPack;
const town = (n: string) => {
  const t = pack.towns.find((x) => x.name === n);
  if (!t) throw new Error(`kasaba yok: ${n}`);
  return t;
};

const izmir = town("İzmir");
const selcuk = town("Selçuk");
const pamukkale = town("Pamukkale");
const req: TripRequest = {
  title: "Ege duman testi",
  startDate: "2026-10-31",
  start: { name: izmir.name, loc: izmir.loc },
  stays: [
    { id: izmir.id, name: izmir.name, loc: izmir.loc, nights: 1 },
    { id: selcuk.id, name: selcuk.name, loc: selcuk.loc, nights: 1 },
    { id: pamukkale.id, name: pamukkale.name, loc: pamukkale.loc, nights: 1 },
  ],
  travelers: 2,
  pace: "dengeli",
  interests: ["tarih", "yemek", "tatli"],
  budget: { amount: 30000, currency: "TRY" },
  transport: "araba",
  dayStart: "08:30",
  dayEnd: "22:00",
  diet: {},
  visitor: "yerli",
};

let t0 = performance.now();
const index = buildPlaceIndex(pack.places);
const ctx = { index, travel: createTravelModel("araba"), seed: 42 };
console.log(`indeks: ${pack.places.length} yer, ${(performance.now() - t0).toFixed(0)} ms`);

t0 = performance.now();
const plan = planTrip(req, pack, ctx);
console.log(`planTrip: ${(performance.now() - t0).toFixed(0)} ms, tahmini toplam ${plan.estTotal} TL\n`);

for (const d of plan.days) {
  console.log(`— ${d.index + 1}. gün ${d.date} · ${d.from.name} → ${d.to.name}${d.isTravelDay ? " (yol)" : ""} · ~${d.estCost} TL`);
  for (const s of d.stops) {
    const p = index.get(s.placeId);
    console.log(`  ${formatHHmm(s.arriveMin)} ${s.slot.padEnd(9)} ${p ? CATEGORIES[p.cat].emoji : "?"} ${p?.name ?? s.placeId}${s.discovered ? " ✨" : ""} · ${s.reasons.slice(0, 2).join(", ")}`);
  }
  if (d.warnings.length) console.log(`  ⚠ ${d.warnings.length} uyarı`);
}

const travel = plan.days.find((d) => d.isTravelDay && d.route);
if (travel?.route) {
  const disc = findCorridorDiscoveries(travel.route, { interests: req.interests }, ctx);
  console.log(`\nyol üstü (${travel.from.name} → ${travel.to.name}): ${disc.slice(0, 6).map((x) => `${x.place.name} [${x.reason}]`).join(" | ")}`);
}

const b = buildBriefing(plan, 0, { index });
console.log(`\nbrifing: ${b.title}\nbildirim: ${b.notification.body}`);

const lunch = plan.days[0]!.stops.find((s) => s.slot === "ogle");
if (lunch) {
  t0 = performance.now();
  const opts = repairDay(plan, 0, { type: "skip", stopId: lunch.id }, { nowMin: lunch.arriveMin - 10 }, ctx);
  console.log(`\nonarım (öğle atlandı): ${(performance.now() - t0).toFixed(0)} ms → ${opts.map((o) => o.label).join(" | ")}`);
}
