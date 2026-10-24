// Kullanım: pnpm --filter @rota/data build-pack <bölge…|all> [--refresh | --offline]
// OSM (Overpass) → önbellek → sınıflandırma → tekilleştirme → doğrulama → apps/web/public/packs/<id>.json
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { overlayFor } from "./curated";
import { CACHE_DIR, loadRegionElements, type RawCache } from "./overpass";
import { assemblePack } from "./pack";
import { getRegion, REGIONS } from "./regions";
import { PackIndexEntrySchema, RegionPackSchema, type PackIndexEntry } from "./schema";

export const PACKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "apps", "web", "public", "packs");

function readIndex(file: string): PackIndexEntry[] {
  if (!existsSync(file)) return [];
  try {
    return PackIndexEntrySchema.array().parse(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return [];
  }
}

function readCache(id: string): RawCache {
  const file = join(CACHE_DIR, `${id}.json`);
  if (!existsSync(file)) throw new Error(`Önbellek yok: ${file} (--offline olmadan çalıştırın)`);
  return JSON.parse(readFileSync(file, "utf8")) as RawCache;
}

async function buildOne(id: string, refresh: boolean, offline: boolean): Promise<void> {
  const region = getRegion(id);
  // --offline: Overpass'a hiç gitme, önbellekte ne varsa (yarım gruplar dahil) onunla üret
  const raw = offline ? readCache(region.id) : await loadRegionElements(region, refresh);
  const { pack, stats } = assemblePack(region, raw, overlayFor(region.id));
  RegionPackSchema.parse(pack);

  mkdirSync(PACKS_DIR, { recursive: true });
  const file = join(PACKS_DIR, `${region.id}.json`);
  writeFileSync(file, JSON.stringify(pack));
  const bytes = statSync(file).size;

  const indexFile = join(PACKS_DIR, "index.json");
  const entry: PackIndexEntry = {
    id: pack.id,
    name: pack.name,
    bbox: pack.bbox,
    places: pack.places.length,
    towns: pack.towns.length,
    generatedAt: pack.generatedAt,
    bytes,
  };
  const index = readIndex(indexFile).filter((e) => e.id !== entry.id);
  index.push(entry);
  index.sort((a, b) => Object.keys(REGIONS).indexOf(a.id) - Object.keys(REGIONS).indexOf(b.id));
  writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);

  const cats = Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(
    `${region.id}: ${stats.elements} öğe (${stats.excluded} yabancı elendi) → ${stats.candidates} aday → ${stats.places} mekân, ` +
      `${stats.towns} kasaba, ${(bytes / 1024 / 1024).toFixed(2)} MB\n  ${cats}`,
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const refresh = args.includes("--refresh");
  const offline = args.includes("--offline");
  let ids = args.filter((a) => !a.startsWith("--"));
  if (ids.includes("all")) ids = Object.keys(REGIONS);
  if (ids.length === 0) {
    console.error(`Kullanım: build-pack <${Object.keys(REGIONS).join("|")}|all> [--refresh]`);
    process.exit(1);
  }
  // Overpass'a nazik olmak için bölgeler sırayla
  for (const id of ids) await buildOne(id, refresh, offline);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
