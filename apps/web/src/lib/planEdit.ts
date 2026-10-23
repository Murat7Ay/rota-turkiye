// Yol üstü keşfi plana ekleme. Çekirdekte bunun için ayrı bir API (ör. repairDay'e
// { type: "add", placeId } olayı) olmadığından, keşif rota üzerindeki sırasına göre araya
// yerleştirilir ve sonraki saatler kaydırılır. Sonuç bir RepairOption olarak döner; böylece
// kullanıcı onaylar ve uygulama applyRepair ile yapılır.
import {
  SLOT_LABELS,
  estimatePlaceCost,
  formatHHmm,
  projectOnLine,
  type Discovery,
  type PlaceIndex,
  type PlanStop,
  type RepairOption,
  type TravelModel,
  type TripPlan,
} from "@rota/core";
import { fmtDuration } from "./format";

export function insertionOption(plan: TripPlan, dayIndex: number, d: Discovery, index: PlaceIndex, travel: TravelModel): RepairOption {
  const day = plan.days[dayIndex];
  if (!day) throw new Error("Gün bulunamadı.");
  const place = d.place;
  const stops = [...day.stops].sort((a, b) => a.arriveMin - b.arriveMin);
  const route = day.route;
  const alongOf = (s: PlanStop) => {
    const p = index.get(s.placeId);
    if (!p || !route) return Infinity;
    return projectOnLine(p.loc, route).alongKm;
  };
  let k = route ? stops.findIndex((s) => alongOf(s) > d.alongKm) : stops.length;
  if (k < 0) k = stops.length;
  const lastLocked = stops.reduce((acc, s, i) => (s.status !== "planned" || s.locked ? i : acc), -1);
  k = Math.max(k, lastLocked + 1);

  const prev = stops[k - 1];
  const next = stops[k];
  const prevLoc = prev ? (index.get(prev.placeId)?.loc ?? day.from.loc) : day.from.loc;
  const nextLoc = next ? (index.get(next.placeId)?.loc ?? day.to.loc) : day.to.loc;
  const legIn = travel.leg(prevLoc, place.loc);
  const legOut = travel.leg(place.loc, nextLoc);
  const arrive = (prev ? prev.departMin : day.startMin) + legIn.min;
  const visit = Math.max(15, place.visitMin || 45);
  const depart = arrive + visit;

  let cost = 0;
  try {
    cost = estimatePlaceCost(place, {
      travelers: plan.request.travelers,
      visitor: plan.request.visitor,
      hasMuzekart: plan.request.hasMuzekart,
      date: day.date,
    }).amountTry;
  } catch {
    cost = 0;
  }

  const added: PlanStop = {
    id: `${day.index}-kesif-${place.id.replace(/[^\w]/g, "")}`,
    placeId: place.id,
    slot: place.slots.includes("gezi") ? "gezi" : (place.slots[0] ?? "gezi"),
    arriveMin: arrive,
    departMin: depart,
    travelMin: legIn.min,
    travelKm: Math.round(legIn.km * 10) / 10,
    estCost: cost,
    reasons: ["Yol üstü keşif", d.reason],
    status: "planned",
    discovered: true,
  };

  const shift = next ? Math.max(0, depart + legOut.min - next.arriveMin) : 0;
  const newStops: PlanStop[] = [];
  stops.forEach((s, i) => {
    if (i === k) newStops.push(added);
    if (i < k) newStops.push(s);
    else if (i === k) newStops.push({ ...s, travelMin: legOut.min, travelKm: Math.round(legOut.km * 10) / 10, arriveMin: s.arriveMin + shift, departMin: s.departMin + shift });
    else newStops.push({ ...s, arriveMin: s.arriveMin + shift, departMin: s.departMin + shift });
  });
  if (k >= stops.length) newStops.push(added);

  const lastDepart = newStops[newStops.length - 1]?.departMin ?? depart;
  const changes = [
    `+ ${place.name} · ${formatHHmm(arrive)}–${formatHHmm(depart)} (${SLOT_LABELS[added.slot].toLocaleLowerCase("tr")})`,
    shift > 0 ? `Sonraki ${stops.length - k} durak ~${fmtDuration(shift)} kayar` : "Diğer durakların saati değişmiyor",
    `Tahmini ek yol ~${fmtDuration(d.detourMin)}${cost ? ` · ek maliyet ~${Math.round(cost)} ₺` : ""}`,
  ];
  if (lastDepart > day.endMin) changes.push(`Gün ${formatHHmm(day.endMin)} sonrasına sarkıyor; bir durağı atlamak gerekebilir.`);

  return {
    id: `ekle-${place.id}`,
    label: `${place.name} rotaya eklensin`,
    description: "Keşif rota üzerindeki sırasına göre araya eklenir. Diğer duraklar korunur, gerekirse saatler kaydırılır.",
    day: { ...day, stops: newStops, estCost: day.estCost + cost },
    changes,
    keptRatio: 1,
  };
}
