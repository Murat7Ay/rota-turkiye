// Mapbox → MapLibre uyarlaması: adres çevirisi ve stil arındırma (ağa çıkılmaz).
import { describe, expect, it } from "vitest";
import * as spec from "@maplibre/maplibre-gl-style-spec";
import { isMapboxToken, sanitizeMapboxStyle, transformMapboxUrl } from "../src/map/mapbox";

const T = "pk.eyJ1IjoidGVzdCJ9.abc_DEF-123";

describe("mapbox adresleri", () => {
  it("anahtar biçimi: yalnız public pk. kabul", () => {
    expect(isMapboxToken(T)).toBe(true);
    expect(isMapboxToken("sk.eyJ1Ijoi.x")).toBe(false);
    expect(isMapboxToken("")).toBe(false);
  });

  it("stil, sprite, font ve karo kümesi çevrilir", () => {
    expect(transformMapboxUrl("mapbox://styles/mapbox/streets-v12", T)).toBe(`https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${T}`);
    expect(transformMapboxUrl("mapbox://sprites/mapbox/streets-v12", T)).toBe(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/sprite?access_token=${T}`);
    expect(transformMapboxUrl("mapbox://fonts/mapbox/DIN Pro Medium/0-255.pbf", T)).toBe(
      `https://api.mapbox.com/fonts/v1/mapbox/DIN Pro Medium/0-255.pbf?access_token=${T}`,
    );
    expect(transformMapboxUrl("mapbox://mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2", T)).toBe(
      `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2.json?secure&access_token=${T}`,
    );
  });

  it("anahtarsız api.mapbox.com isteğine anahtar eklenir, diğerlerine dokunulmaz", () => {
    expect(transformMapboxUrl("https://api.mapbox.com/v4/x/1/2/3.vector.pbf", T)).toContain(`access_token=${T}`);
    expect(transformMapboxUrl(`https://api.mapbox.com/a?access_token=${T}`, T)).toBe(`https://api.mapbox.com/a?access_token=${T}`);
    expect(transformMapboxUrl("https://tiles.openfreemap.org/planet", T)).toBe("https://tiles.openfreemap.org/planet");
  });

  it("sprite tabanı anahtarı sorguda tutar; MapLibre son eki yola ekler", () => {
    const base = new URL(transformMapboxUrl("mapbox://sprites/mapbox/streets-v12", T));
    base.pathname += "@2x.json";
    expect(base.toString()).toBe(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/sprite@2x.json?access_token=${T}`);
  });
});

describe("stil arındırma", () => {
  const mapboxStyle = {
    version: 8,
    name: "Mapbox Streets",
    fog: { range: [1, 10] },
    projection: { name: "globe" },
    imports: [],
    sprite: "mapbox://sprites/mapbox/streets-v12",
    glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    sources: { composite: { type: "vector", url: "mapbox://mapbox.mapbox-streets-v8" } },
    layers: [
      { id: "land", type: "background", paint: { "background-color": "#eee" } },
      {
        id: "road",
        type: "line",
        source: "composite",
        "source-layer": "road",
        slot: "middle",
        paint: { "line-color": "#fff", "line-emissive-strength": 1, "line-width": 2 },
      },
      { id: "trees", type: "model", source: "composite", "source-layer": "tree" },
      { id: "bad", type: "fill", source: "composite", "source-layer": "water", paint: { "fill-color": ["config", "theme"] } },
    ],
  };

  it("Mapbox'a özgü kök, katman ve özellikler atılır; adresler çevrilir; sonuç geçerli", () => {
    const out = sanitizeMapboxStyle(mapboxStyle, spec as never, T) as unknown as Record<string, unknown>;
    expect(out).not.toHaveProperty("fog");
    expect(out).not.toHaveProperty("projection");
    expect(out).not.toHaveProperty("imports");
    const layers = out.layers as Array<Record<string, unknown>>;
    expect(layers.map((l) => l.id)).toEqual(["land", "road"]);
    expect(layers[1]).not.toHaveProperty("slot");
    expect(layers[1]!.paint).toEqual({ "line-color": "#fff", "line-width": 2 });
    expect((out.sources as Record<string, { url: string }>).composite.url).toContain("api.mapbox.com/v4/mapbox.mapbox-streets-v8.json");
    expect(String(out.glyphs)).toBe(`https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${encodeURIComponent(T)}`);
    expect(String(out.sprite)).toContain("/sprite?access_token=");
    expect(spec.validateStyleMin(out)).toEqual([]);
    // girdi değiştirilmez
    expect(mapboxStyle).toHaveProperty("fog");
  });
});
