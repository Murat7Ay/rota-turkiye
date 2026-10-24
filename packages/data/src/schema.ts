// RegionPack için zod şeması; @rota/core türlerinin birebir aynası (aşağıdaki tür denetimleri
// çekirdekte bir alan değişirse derlemeyi kırar).
import { z } from "zod";
import { CATEGORIES, type Place, type PlaceCategory, type PlaceTag, type RegionPack, type Slot, type Town } from "@rota/core";

const CATS = Object.keys(CATEGORIES) as [PlaceCategory, ...PlaceCategory[]];
const SLOTS = ["kahvalti", "ogle", "aksam", "cay", "tatli", "alisveris", "gezi", "konaklama"] as const satisfies readonly Slot[];
const TAGS = [
  "unesco",
  "michelin",
  "bib_gourmand",
  "gault_millau",
  "tarihi",
  "yerel",
  "manzara",
  "cografi_isaret",
  "muzekart",
  "aile",
  "erisilebilir",
  "wikidata",
] as const satisfies readonly PlaceTag[];

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const LatLngSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const PriceObservationSchema = z.strictObject({
  amount: z.number().nonnegative(),
  currency: z.enum(["TRY", "EUR", "USD"]),
  perPerson: z.boolean(),
  observedAt: isoDay,
  source: z.string().min(1),
  kind: z.enum(["observed", "estimate"]),
});

export const PlaceSchema = z.strictObject({
  id: z.string().regex(/^(osm:[nwr]\d+|cur:[a-z0-9-]+)$/),
  name: z.string().min(1),
  cat: z.enum(CATS),
  loc: LatLngSchema,
  slots: z.array(z.enum(SLOTS)).min(1),
  visitMin: z.number().int().nonnegative(),
  openingHours: z.string().min(1).optional(),
  priceTier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  price: PriceObservationSchema.optional(),
  priceForeign: PriceObservationSchema.optional(),
  indoor: z.boolean().optional(),
  alcohol: z.boolean().optional(),
  vegFriendly: z.boolean().optional(),
  notability: z.number().min(0).max(1),
  quality: z.number().min(0).max(1).optional(),
  tags: z.array(z.enum(TAGS)),
  city: z.string().min(1).optional(),
  district: z.string().min(1).optional(),
  wikidata: z.string().regex(/^Q\d+$/).optional(),
  website: z.string().regex(/^https?:\/\//).optional(),
  source: z.enum(["osm", "curated"]),
  lastVerified: isoDay.optional(),
  note: z.string().min(1).optional(),
});

export const TownSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  loc: LatLngSchema,
  kind: z.enum(["city", "town", "village"]),
  population: z.number().int().positive().optional(),
});

export const RegionPackSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  version: z.string().regex(/^\d{4}\.\d{1,2}\.\d{1,2}$/),
  generatedAt: z.iso.datetime(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  attribution: z.string().min(1),
  towns: z.array(TownSchema),
  places: z.array(PlaceSchema),
});

export const PackIndexEntrySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  places: z.number().int().nonnegative(),
  towns: z.number().int().nonnegative(),
  generatedAt: z.string(),
  bytes: z.number().int().positive(),
});
export type PackIndexEntry = z.infer<typeof PackIndexEntrySchema>;

// --- çekirdek türleriyle karşılıklı uyum denetimi (yalnızca derleme zamanı)
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const placeOk: Same<z.infer<typeof PlaceSchema>, Place> = true;
const townOk: Same<z.infer<typeof TownSchema>, Town> = true;
const packOk: Same<z.infer<typeof RegionPackSchema>, RegionPack> = true;
const slotOk: Same<(typeof SLOTS)[number], Slot> = true;
const tagOk: Same<(typeof TAGS)[number], PlaceTag> = true;
void [placeOk, townOk, packOk, slotOk, tagOk];
