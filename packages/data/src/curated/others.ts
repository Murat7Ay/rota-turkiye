// Pilot dışı küçük bölgelerin kürasyon katmanları. Yalnızca iyi bilinen bilgiler.
import type { RegionOverlay } from "./types";

// UNESCO: Göreme Millî Parkı ve Kapadokya Kayalık Alanları (1985)
export const KAPADOKYA_OVERLAY: RegionOverlay = {
  entries: [
    {
      id: "goreme-acik-hava",
      match: /goreme.*(acik ?hava|muze|open[- ]air|museum)/,
      cats: ["muze", "antik_kent", "tarihi_yapi"],
      near: { lat: 38.6406, lon: 34.8456, km: 1.5 },
      tags: ["unesco", "muzekart", "tarihi"],
      minNotability: 1,
      visitMin: 120,
    },
    {
      id: "zelve",
      match: /zelve/,
      notMatch: /otel|hotel|pansiyon/,
      cats: ["muze", "antik_kent", "tarihi_yapi"],
      near: { lat: 38.673, lon: 34.865, km: 1.5 },
      tags: ["muzekart", "tarihi"],
      minNotability: 0.8,
    },
    {
      id: "kaymakli",
      match: /kaymakli.*(yeralti|underground)/,
      cats: ["muze", "antik_kent", "tarihi_yapi"],
      near: { lat: 38.4612, lon: 34.7514, km: 1.5 },
      tags: ["muzekart", "tarihi"],
      minNotability: 0.85,
    },
  ],
  // Ürgüp – Uçhisar – Ortahisar bağları
  wineAreas: [{ lat: 38.63, lon: 34.87, km: 10 }],
  keepTowns: ["goreme", "uchisar", "ortahisar", "cavusin", "mustafapasa", "ibrahimpasa", "ayvali", "kaymakli", "derinkuyu"],
};

// UNESCO: İstanbul'un Tarihi Alanları (1985)
export const ISTANBUL_OVERLAY: RegionOverlay = {
  entries: [
    {
      id: "ayasofya",
      match: /ayasofya|aya sofya|hagia sophia/,
      notMatch: /otel|hotel|kucuk|hamam/,
      cats: ["cami", "muze", "tarihi_yapi"],
      near: { lat: 41.0086, lon: 28.9802, km: 0.4 },
      tags: ["unesco", "tarihi"],
      minNotability: 1,
    },
    {
      id: "sultanahmet-camii",
      match: /sultan ?ahmet camii|blue mosque/,
      cats: ["cami", "tarihi_yapi"],
      near: { lat: 41.0054, lon: 28.9768, km: 0.4 },
      tags: ["unesco", "tarihi"],
      minNotability: 1,
    },
    {
      id: "suleymaniye-camii",
      match: /suleymaniye camii|suleymaniye mosque/,
      cats: ["cami", "tarihi_yapi"],
      near: { lat: 41.0162, lon: 28.9639, km: 0.4 },
      tags: ["unesco", "tarihi"],
      minNotability: 0.95,
    },
    {
      id: "topkapi",
      match: /topkapi sarayi|topkapi palace/,
      notMatch: /otel|hotel/,
      cats: ["muze", "tarihi_yapi"],
      near: { lat: 41.0115, lon: 28.9834, km: 0.6 },
      setCat: "muze",
      tags: ["unesco", "muzekart", "tarihi"],
      minNotability: 1,
      visitMin: 150,
      note: "Harem bölümü Müzekart'a dahil değildir.",
    },
    {
      id: "istanbul-arkeoloji",
      match: /arkeoloji muze|archaeolog/,
      cats: ["muze"],
      near: { lat: 41.0117, lon: 28.9813, km: 0.4 },
      tags: ["muzekart"],
      minNotability: 0.85,
    },
    {
      id: "turk-islam-eserleri",
      match: /turk (ve )?islam eserleri|turkish and islamic arts/,
      cats: ["muze"],
      near: { lat: 41.0063, lon: 28.9748, km: 0.4 },
      tags: ["muzekart"],
      minNotability: 0.8,
    },
  ],
  wineAreas: [],
  keepTowns: [
    "sultanahmet",
    "eminonu",
    "sirkeci",
    "karakoy",
    "galata",
    "cihangir",
    "taksim",
    "beyoglu",
    "balat",
    "fener",
    "fatih",
    "kumkapi",
    "cankurtaran",
    "kadikoy",
    "moda",
    "uskudar",
    "kuzguncuk",
  ],
};
