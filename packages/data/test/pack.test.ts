// Üretilmiş Ege paketi varsa (apps/web/public/packs/ege.json) içeriğini doğrular.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RegionPack } from "@rota/core";
import { PackIndexEntrySchema, RegionPackSchema } from "../src/schema";

const PACKS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "apps", "web", "public", "packs");
const EGE = join(PACKS, "ege.json");
const hasPack = existsSync(EGE);

describe.skipIf(!hasPack)("ege.json paketi", () => {
  const pack = (hasPack ? JSON.parse(readFileSync(EGE, "utf8")) : {}) as RegionPack;
  const byCat = (c: string) => pack.places.filter((p) => p.cat === c);

  it("şemaya uyar ve en az 1.000 mekân içerir", () => {
    expect(() => RegionPackSchema.parse(pack)).not.toThrow();
    expect(pack.places.length).toBeGreaterThanOrEqual(1000);
    expect(pack.attribution).toMatch(/OpenStreetMap/);
  });

  it("kimlikler benzersiz", () => {
    expect(new Set(pack.places.map((p) => p.id)).size).toBe(pack.places.length);
    expect(new Set(pack.towns.map((t) => t.id)).size).toBe(pack.towns.length);
  });

  it("Efes antik kenti UNESCO olarak var", () => {
    const efes = byCat("antik_kent").find((p) => /efes|ephesus|ephesos/i.test(p.name));
    expect(efes).toBeDefined();
    expect(efes!.tags).toContain("unesco");
  });

  it("Türkiye'ye özgü kategoriler dolu", () => {
    for (const c of ["cay_bahcesi", "esnaf_lokantasi", "tatlici", "kahvehane", "pazar", "kebapci"]) {
      expect(byCat(c).length, c).toBeGreaterThan(0);
    }
    expect(byCat("otel").length + byCat("pansiyon").length + byCat("butik_otel").length).toBeGreaterThan(50);
  });

  it("İzmir, Selçuk ve Denizli kasaba listesinde", () => {
    const names = pack.towns.map((t) => t.name);
    for (const n of ["İzmir", "Selçuk", "Denizli"]) expect(names).toContain(n);
  });

  it("bütün mekânlar paket kutusunda", () => {
    const [w, s, e, n] = pack.bbox;
    expect(pack.places.every((p) => p.loc.lon >= w && p.loc.lon <= e && p.loc.lat >= s && p.loc.lat <= n)).toBe(true);
  });

  it("index.json paketi listeler", () => {
    const index = PackIndexEntrySchema.array().parse(JSON.parse(readFileSync(join(PACKS, "index.json"), "utf8")));
    const entry = index.find((e) => e.id === "ege");
    expect(entry?.places).toBe(pack.places.length);
  });
});
