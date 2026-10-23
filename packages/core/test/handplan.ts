// Bütçe ve brifing testleri için elle kurulmuş plan (planTrip'e bağımlı değil).
// Fiyatlar ve saatler test için uydurulmuştur.
import { calendarWarnings } from "../src/calendar";
import { fuelCostTry } from "../src/pricing";
import { parseHHmm } from "../src/time";
import type { DayPlan, NamedPoint, PlanStop, Slot, TripPlan } from "../src/types";
import { EGE_REQUEST, IZMIR, PAMUKKALE, ROUTE_SELCUK_PAMUKKALE, SELCUK } from "./fixtures";

export function hstop(
  id: string,
  placeId: string,
  slot: Slot,
  arrive: string,
  depart: string,
  estCost: number,
  travelKm = 2,
  travelMin = 6,
): PlanStop {
  return {
    id,
    placeId,
    slot,
    arriveMin: parseHHmm(arrive),
    departMin: parseHHmm(depart),
    travelMin,
    travelKm,
    estCost,
    reasons: [],
    status: "planned",
  };
}

export const HOTEL_COST = [3600, 3600, 3500] as const;

function hday(
  index: number,
  date: string,
  from: NamedPoint,
  to: NamedPoint,
  stops: PlanStop[],
  hotelCost: number,
  extra: Partial<DayPlan>,
): DayPlan {
  const km = stops.reduce((a, s) => a + s.travelKm, 0);
  return {
    index,
    date,
    from,
    to,
    isTravelDay: from.name !== to.name,
    startMin: parseHHmm("08:30"),
    endMin: parseHHmm("22:00"),
    stops,
    alternatives: {},
    estCost: stops.reduce((a, s) => a + s.estCost, 0) + hotelCost + fuelCostTry(km),
    warnings: calendarWarnings(date),
    ...extra,
  };
}

const SELCUK_PT: NamedPoint = { name: "Selçuk", loc: SELCUK.loc };
const PAMUKKALE_PT: NamedPoint = { name: "Pamukkale", loc: PAMUKKALE.loc };

/** 27–29 Ekim 2026: İzmir → Selçuk, Selçuk, Selçuk → Pamukkale. Bütçe 30.000 TL, 2 kişi. */
export function makeHandPlan(): TripPlan {
  const days: DayPlan[] = [
    hday(
      0,
      "2026-10-27",
      IZMIR,
      SELCUK_PT,
      [
        hstop("d0-kahvalti", "fx:kahvalti2", "kahvalti", "09:30", "10:30", 1100, 70, 60),
        hstop("d0-efes", "fx:efes", "gezi", "11:00", "13:00", 900, 5, 10),
        hstop("d0-ogle", "fx:esnaf1", "ogle", "13:20", "14:05", 1100, 3, 8),
        hstop("d0-cay", "fx:cay1", "cay", "16:00", "16:40", 160, 1, 3),
        hstop("d0-aksam", "fx:rest1", "aksam", "19:30", "21:00", 1800, 1, 3),
      ],
      HOTEL_COST[0],
      { stayId: "selcuk", hotelPlaceId: "fx:otel-selcuk" },
    ),
    hday(
      1,
      "2026-10-28",
      SELCUK_PT,
      SELCUK_PT,
      [
        hstop("d1-kahvalti", "fx:kahvalti2", "kahvalti", "08:45", "09:45", 1000, 1, 3),
        hstop("d1-ayasuluk", "fx:ayasuluk", "gezi", "10:00", "10:40", 0, 1, 4),
        hstop("d1-ogle", "fx:esnaf1", "ogle", "12:30", "13:15", 1000, 1, 3),
        hstop("d1-muze", "fx:efes-muze", "gezi", "15:00", "16:15", 600, 2, 6),
        hstop("d1-cay", "fx:cay1", "cay", "16:30", "17:10", 160, 1, 3),
        hstop("d1-aksam", "fx:rest1", "aksam", "19:30", "21:00", 1700, 1, 3),
      ],
      HOTEL_COST[1],
      {
        stayId: "selcuk",
        hotelPlaceId: "fx:otel-selcuk",
        alternatives: { "d1-ayasuluk": ["fx:artemis"], "d1-cay": ["fx:kahvehane"], "d1-ogle": ["fx:esnaf2"] },
      },
    ),
    hday(
      2,
      "2026-10-29",
      SELCUK_PT,
      PAMUKKALE_PT,
      [
        hstop("d2-kahvalti", "fx:kahvalti2", "kahvalti", "08:30", "09:15", 1000, 1, 3),
        hstop("d2-nysa", "fx:nysa", "gezi", "10:45", "12:15", 900, 70, 55),
        hstop("d2-ogle", "fx:pk-esnaf", "ogle", "14:00", "14:45", 1100, 95, 80),
        hstop("d2-hierapolis", "fx:hierapolis", "gezi", "15:00", "17:30", 900, 2, 6),
        hstop("d2-aksam", "fx:pk-rest", "aksam", "19:30", "21:00", 1800, 2, 6),
      ],
      HOTEL_COST[2],
      {
        stayId: "pamukkale",
        hotelPlaceId: "fx:otel-pk",
        alternatives: { "d2-nysa": ["fx:tripolis"] },
        route: ROUTE_SELCUK_PAMUKKALE,
      },
    ),
  ];
  return {
    id: "trip-test",
    createdAt: "2026-10-24T00:00:00.000Z",
    packId: "test",
    request: { ...EGE_REQUEST, startDate: "2026-10-27", travelers: 2, budget: { amount: 30000, currency: "TRY" } },
    days,
    estTotal: days.reduce((a, d) => a + d.estCost, 0),
    version: 1,
  };
}
