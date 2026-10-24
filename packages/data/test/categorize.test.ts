// Elle yazılmış OSM öğeleri. Adlar ve saatler test içindir; gerçek mekânları temsil etmez.
import { describe, expect, it } from "vitest";
import { categorize, type Candidate } from "../src/categorize";
import { EGE_OVERLAY } from "../src/curated/ege";
import { validOpeningHours } from "../src/opening-hours";
import type { OsmElement } from "../src/overpass";
import { applySites, assemblePack, buildTowns, dedup } from "../src/pack";
import { REGIONS } from "../src/regions";
import { RegionPackSchema } from "../src/schema";
import { fold, normName, slug } from "../src/text";

let seq = 1;
const IZMIR = { lat: 38.4237, lon: 27.1428 };

function el(tags: Record<string, string>, at: { lat: number; lon: number } = IZMIR, type: OsmElement["type"] = "node"): OsmElement {
  const id = seq++;
  return type === "node" ? { type, id, lat: at.lat, lon: at.lon, tags } : { type, id, center: { lat: at.lat, lon: at.lon }, tags };
}

function cat(tags: Record<string, string>, at?: { lat: number; lon: number }) {
  return categorize(el(tags, at), EGE_OVERLAY)?.place;
}

describe("metin katlama", () => {
  it("Türkçe harfleri ASCII'ye indirger", () => {
    expect(fold("İZMİR ÇAY BAHÇESİ")).toBe("izmir cay bahcesi");
    expect(fold("Kıraathanesi")).toBe("kiraathanesi");
    expect(fold("ICE CREAM")).toBe("ice cream");
    expect(normName("Ömür  Esnaf-Lokantası!")).toBe("omur esnaf lokantasi");
    expect(slug("Selçuk")).toBe("selcuk");
  });
});

describe("yeme-içme kuralları", () => {
  it("çay bahçesi: OSM etiketi yok, addan bulunur", () => {
    const p = cat({ amenity: "cafe", name: "Kordon Çay Bahçesi" })!;
    expect(p.cat).toBe("cay_bahcesi");
    expect(p.tags).toContain("yerel");
    expect(p.indoor).toBe(false);
    expect(p.slots).toContain("cay");
    expect(cat({ amenity: "cafe", name: "Aile Çay Bahçesi" })!.tags).toContain("aile");
    expect(cat({ amenity: "cafe", name: "Yokuş Çay Ocağı" })!.cat).toBe("cay_bahcesi");
  });

  it("kahvehane / kıraathane", () => {
    expect(cat({ amenity: "cafe", name: "Merkez Kıraathanesi" })!.cat).toBe("kahvehane");
    expect(cat({ amenity: "cafe", name: "Emekliler Kahvehanesi" })!.tags).toContain("yerel");
    expect(cat({ amenity: "cafe", name: "Köy Kahvesi" })!.cat).toBe("kahvehane");
  });

  it("esnaf lokantası", () => {
    const p = cat({ amenity: "restaurant", name: "Ömür Esnaf Lokantası", cuisine: "turkish" })!;
    expect(p.cat).toBe("esnaf_lokantasi");
    expect(p.tags).toContain("yerel");
    expect(cat({ amenity: "restaurant", name: "Ayşe Ev Yemekleri" })!.cat).toBe("esnaf_lokantasi");
    expect(cat({ amenity: "restaurant", name: "Usta", cuisine: "home_cooking" })!.cat).toBe("esnaf_lokantasi");
  });

  it("kebapçı ve pideci", () => {
    expect(cat({ amenity: "restaurant", name: "Halil Usta", cuisine: "kebab" })!.cat).toBe("kebapci");
    expect(cat({ amenity: "restaurant", name: "Ali Ocakbaşı" })!.cat).toBe("kebapci");
    expect(cat({ amenity: "fast_food", name: "Ciğerci Mehmet" })!.cat).toBe("kebapci");
    expect(cat({ amenity: "restaurant", name: "Karadeniz Pide Salonu" })!.cat).toBe("pideci");
    expect(cat({ amenity: "fast_food", name: "Usta Fırın", cuisine: "lahmacun" })!.cat).toBe("pideci");
  });

  it("meyhane alkollüdür", () => {
    const p = cat({ amenity: "restaurant", name: "Kemeraltı Meyhanesi" })!;
    expect(p.cat).toBe("meyhane");
    expect(p.alcohol).toBe(true);
  });

  it("balıkçı; 'Balıkesir' balık sayılmaz", () => {
    expect(cat({ amenity: "restaurant", name: "Deniz Restaurant", cuisine: "seafood" })!.cat).toBe("balikci");
    expect(cat({ amenity: "restaurant", name: "Balıkçı Hasan" })!.cat).toBe("balikci");
    expect(cat({ amenity: "restaurant", name: "Balıkesir Kebap" })!.cat).toBe("kebapci");
  });

  it("kahvaltı", () => {
    const p = cat({ amenity: "restaurant", name: "Şirince Serpme Kahvaltı" })!;
    expect(p.cat).toBe("kahvalti");
    expect(p.slots).toContain("kahvalti");
    expect(cat({ amenity: "cafe", name: "Sabah", cuisine: "breakfast" })!.cat).toBe("kahvalti");
  });

  it("tatlıcı ve fırın", () => {
    expect(cat({ shop: "pastry", name: "Ali Usta Pastanesi" })!.cat).toBe("tatlici");
    expect(cat({ shop: "confectionery", name: "Hacı Lokum" })!.cat).toBe("tatlici");
    expect(cat({ amenity: "restaurant", name: "Künefeci Yusuf" })!.cat).toBe("tatlici");
    expect(cat({ amenity: "ice_cream", name: "Dondurmacı" })!.cat).toBe("tatlici");
    expect(cat({ amenity: "cafe", name: "Sevinç Pastanesi" })!.cat).toBe("tatlici");
    expect(cat({ shop: "bakery", name: "Baklavacı Hüseyin" })!.cat).toBe("tatlici");
    expect(cat({ shop: "bakery", name: "Taş Fırın" })!.cat).toBe("firin");
    expect(cat({ amenity: "cafe", name: "Gevrek & Boyoz" })!.cat).toBe("firin");
    expect(cat({ amenity: "cafe", name: "Şeyma Unlumamülleri" })!.cat).toBe("firin");
    expect(cat({ shop: "pastry", name: "Yonca Un Mamulleri" })!.cat).toBe("firin");
    expect(cat({ shop: "confectionery", name: "Tuğba Kuruyemiş" })).toBeUndefined();
    expect(cat({ amenity: "cafe", name: "Coffee 333", cuisine: "coffee_shop;cake" })!.cat).toBe("kafe");
  });

  it("çok mutfaklı kahvaltı etiketi addaki işaretin önüne geçmez", () => {
    expect(cat({ amenity: "restaurant", name: "Ada Balık", cuisine: "seafood;breakfast" })!.cat).toBe("balikci");
    const p = cat({ amenity: "restaurant", name: "Mavi Deniz Pide & Kebap", cuisine: "breakfast;turkish" })!;
    expect(p.cat).toBe("kebapci");
    expect(p.slots).toContain("kahvalti");
    expect(cat({ amenity: "restaurant", name: "Çorbacı Durmuş Usta" })!.cat).toBe("esnaf_lokantasi");
    expect(cat({ amenity: "restaurant", name: "Dutdibi Et Mangal" })!.cat).toBe("kebapci");
  });

  it("kafe ve restoran varsayılanı; Türk mutfağı olmayan fast food atılır", () => {
    expect(cat({ amenity: "cafe", name: "Kallinos Coffee", cuisine: "coffee_shop" })!.cat).toBe("kafe");
    expect(cat({ amenity: "restaurant", name: "Trattoria Roma", cuisine: "italian" })!.cat).toBe("restoran");
    expect(cat({ amenity: "fast_food", name: "Burger House", cuisine: "burger" })).toBeUndefined();
    expect(cat({ amenity: "fast_food", name: "Kumrucu Ahmet" })!.cat).toBe("restoran");
  });

  it("dinlenme tesisi", () => {
    expect(cat({ highway: "services", name: "Belevi Dinlenme Tesisi" })!.cat).toBe("dinlenme_tesisi");
    expect(cat({ amenity: "restaurant", name: "Yol Üstü Dinlenme Tesisleri" })!.cat).toBe("dinlenme_tesisi");
  });
});

describe("alışveriş kuralları", () => {
  it("semt pazarı saati korunur; saat yoksa adındaki gün nota yazılır", () => {
    const withHours = cat({ amenity: "marketplace", name: "Cumartesi Pazarı", opening_hours: "Sa 07:00-18:00" })!;
    expect(withHours.cat).toBe("pazar");
    expect(withHours.openingHours).toBe("Sa 07:00-18:00");
    expect(withHours.tags).toContain("yerel");
    const noHours = cat({ amenity: "marketplace", name: "Tire Salı Pazarı" })!;
    expect(noHours.openingHours).toBeUndefined();
    expect(noHours.note).toMatch(/Salı/);
  });

  it("tarihi çarşı / han", () => {
    expect(cat({ historic: "building", tourism: "attraction", shop: "yes", name: "Yıldız Hanı" })!.cat).toBe("carsi");
    expect(cat({ landuse: "retail", historic: "yes", wikidata: "Q1", name: "Kapalı Çarşı" })!.cat).toBe("carsi");
    expect(cat({ amenity: "marketplace", name: "Yeni Çarşı" })!.cat).toBe("pazar");
    expect(cat({ historic: "caravanserai", name: "Kervan Hanı" })!.cat).toBe("tarihi_yapi");
  });

  it("yöresel ürün", () => {
    expect(cat({ shop: "deli", name: "Tire Yöresel Ürünler" })!.cat).toBe("yoresel_urun");
    expect(cat({ shop: "farm", name: "Yamaç Çiftliği" })!.cat).toBe("yoresel_urun");
    expect(cat({ shop: "deli", name: "Zeytinyağı Dükkanı" })!.cat).toBe("yoresel_urun");
    expect(cat({ shop: "deli", name: "Mega Şarküteri" })).toBeUndefined();
    expect(cat({ shop: "souvenir", name: "Efes Hediyelik" })!.cat).toBe("hediyelik");
  });

  it("şarap yalnızca Urla/Şirince bağ bölgesinde yöresel ürün", () => {
    const urla = cat({ shop: "wine", name: "Bağ Evi" }, { lat: 38.31, lon: 26.77 })!;
    expect(urla.cat).toBe("yoresel_urun");
    expect(urla.alcohol).toBe(true);
    expect(cat({ craft: "winery", name: "Şirince Şarapçısı" }, { lat: 37.944, lon: 27.434 })!.cat).toBe("yoresel_urun");
    expect(cat({ shop: "wine", name: "Şarap Evi" }, IZMIR)).toBeUndefined();
  });
});

describe("gezi ve konaklama kuralları", () => {
  it("ören yeri, müze, yapı, manzara, plaj, doğa, cami", () => {
    expect(cat({ historic: "archaeological_site", name: "Teos", wikidata: "Q2" })!.cat).toBe("antik_kent");
    expect(cat({ historic: "archaeological_site", name: "Küçük Höyük" })!.cat).toBe("tarihi_yapi");
    expect(cat({ tourism: "museum", name: "Kent Müzesi" })!.cat).toBe("muze");
    expect(cat({ historic: "castle", name: "Ayasuluk Kalesi" })!.cat).toBe("tarihi_yapi");
    const v = cat({ tourism: "viewpoint", name: "Seyir Terası" })!;
    expect(v.cat).toBe("manzara");
    expect(v.tags).toContain("manzara");
    expect(cat({ natural: "beach", name: "Ilıca Plajı" })!.cat).toBe("plaj");
    expect(cat({ natural: "beach", name: "Otel Plajı", access: "private" })).toBeUndefined();
    expect(cat({ natural: "waterfall", name: "Değirmen Şelalesi" })!.cat).toBe("dogal_alan");
    expect(cat({ natural: "spring", name: "Adsız Pınar" })).toBeUndefined();
    expect(cat({ amenity: "place_of_worship", religion: "muslim", historic: "yes", name: "İsa Bey Camii" })!.cat).toBe("cami");
    expect(cat({ historic: "monument", name: "Atatürk Büstü" })).toBeUndefined();
    expect(cat({ tourism: "attraction", name: "Saat Kulesi" })!.cat).toBe("tarihi_yapi");
    expect(cat({ tourism: "attraction", name: "Bilinmeyen Şey" })).toBeUndefined();
  });

  it("konaklama türleri ve yıldızdan fiyat kademesi", () => {
    const h = cat({ tourism: "hotel", name: "Büyük Otel", stars: "5" })!;
    expect(h.cat).toBe("otel");
    expect(h.priceTier).toBe(4);
    expect(h.slots).toEqual(["konaklama"]);
    expect(cat({ tourism: "hotel", name: "Alaçatı Taş Butik Otel" })!.cat).toBe("butik_otel");
    expect(cat({ tourism: "guest_house", name: "Şirince Konuk Evi" })!.cat).toBe("pansiyon");
    expect(cat({ tourism: "hostel", name: "Gezgin Hostel" })!.cat).toBe("pansiyon");
    expect(cat({ tourism: "motel", name: "Yol Motel" })!.cat).toBe("otel");
    expect(cat({ tourism: "camp_site", name: "Zeytinlik Kamp" })!.cat).toBe("kamp");
    expect(cat({ tourism: "apartment", name: "Daire" })).toBeUndefined();
  });

  it("adsız, genel adlı ve yerleşim öğeleri atlanır", () => {
    expect(cat({ amenity: "cafe" })).toBeUndefined();
    expect(cat({ amenity: "cafe", name: "Cafe" })).toBeUndefined();
    expect(cat({ place: "village", name: "Şirince" })).toBeUndefined();
    expect(cat({ amenity: "restaurant", name: "Kapandı", opening_hours: "closed" })).toBeUndefined();
  });
});

describe("marka ve zincirler", () => {
  it("uluslararası zincirler hiç alınmaz", () => {
    expect(cat({ amenity: "fast_food", name: "McDonald's", brand: "McDonald's", cuisine: "burger" })).toBeUndefined();
    expect(cat({ amenity: "cafe", name: "Starbucks", brand: "Starbucks" })).toBeUndefined();
    expect(cat({ amenity: "fast_food", name: "Kumpir", brand: "Burger King", cuisine: "kebab" })).toBeUndefined();
  });

  it("markalı yerli zincir: yerel etiketi yok, önem düşük; fast-food zincirleri hiç alınmaz", () => {
    expect(cat({ amenity: "cafe", name: "Simit Sarayı", brand: "Simit Sarayı", "brand:wikidata": "Q3" })).toBeUndefined();
    expect(cat({ amenity: "fast_food", name: "Komagene", cuisine: "kebab" })).toBeUndefined();
    const mado = cat({ amenity: "cafe", name: "Mado", brand: "Mado", "brand:wikidata": "Q3", shop: "confectionery" })!;
    expect(mado.cat).toBe("tatlici");
    expect(mado.tags).not.toContain("yerel");
    expect(mado.notability).toBe(0);
    const zincir = cat({ amenity: "restaurant", name: "Zincir Esnaf Lokantası", brand: "Zincir" })!;
    expect(zincir.cat).toBe("esnaf_lokantasi");
    expect(zincir.tags).not.toContain("yerel");
  });
});

describe("önem ve etiketler", () => {
  it("sinyaller toplanır ve 0..1 aralığına kırpılır", () => {
    expect(cat({ amenity: "cafe", name: "Sade Kafe" })!.notability).toBe(0.1);
    expect(cat({ amenity: "cafe", name: "Saatli Kafe", opening_hours: "Mo-Su 08:00-22:00" })!.notability).toBe(0.15);
    expect(cat({ amenity: "cafe", name: "Webli Kafe", website: "https://ornek.test" })!.notability).toBe(0.13);
    const rich = cat({
      historic: "archaeological_site",
      tourism: "attraction",
      wikidata: "Q4",
      heritage: "2",
      name: "Büyük Ören Yeri",
    })!;
    expect(rich.notability).toBe(0.95);
    expect(rich.tags).toEqual(expect.arrayContaining(["wikidata", "tarihi"]));
    const capped = cat({ ...{ historic: "castle", tourism: "attraction", wikidata: "Q5", heritage: "1", "heritage:operator": "whc" }, name: "Kale", opening_hours: "Mo-Su 09:00-17:00", website: "https://k.test" })!;
    expect(capped.notability).toBe(1);
    expect(capped.tags).toContain("unesco");
    // heritage=1 tek başına yetmez (OSM'de geçici listedekiler de böyle etiketli)
    expect(cat({ historic: "castle", wikidata: "Q6", heritage: "1", name: "Aday Kale" })!.tags).not.toContain("unesco");
  });

  it("tarihi: 1960 öncesi kuruluş ya da addaki işaret", () => {
    const old = cat({ amenity: "restaurant", name: "Usta Lokantası", start_date: "1925" })!;
    expect(old.tags).toContain("tarihi");
    expect(old.notability).toBe(0.25);
    expect(cat({ amenity: "restaurant", name: "Yeni Lokanta", start_date: "1998" })!.tags).not.toContain("tarihi");
    expect(cat({ amenity: "restaurant", name: "Tarihi Kemeraltı Köftecisi" })!.tags).toContain("tarihi");
    expect(cat({ shop: "pastry", name: "Pastane Since 1923" })!.tags).toContain("tarihi");
    expect(cat({ shop: "pastry", name: "1890'dan beri Helvacı" })!.tags).toContain("tarihi");
  });

  it("erişilebilirlik, vejetaryen, alkol, son doğrulama", () => {
    const p = cat({
      amenity: "restaurant",
      name: "Yeşil Sofra",
      wheelchair: "yes",
      "diet:vegetarian": "yes",
      "drink:wine": "served",
      check_date: "2025-06-01",
    })!;
    expect(p.tags).toContain("erisilebilir");
    expect(p.vegFriendly).toBe(true);
    expect(p.alcohol).toBe(true);
    expect(p.lastVerified).toBe("2025-06-01");
  });

  it("kimlik, ad önceliği, koordinat yuvarlama, boş alan yok", () => {
    const c = categorize(el({ amenity: "cafe", name: "Kordon Cafe", "name:tr": "Kordon Kafe" }, { lat: 38.123456789, lon: 27.987654321 }, "way"))!;
    expect(c.place.id).toMatch(/^osm:w\d+$/);
    expect(c.place.name).toBe("Kordon Kafe");
    expect(c.place.loc).toEqual({ lat: 38.12346, lon: 27.98765 });
    expect(Object.values(c.place).some((v) => v === undefined)).toBe(false);
  });
});

describe("kürasyon katmanı: UNESCO ve Müzekart", () => {
  const EFES = { lat: 37.9395, lon: 27.341 };
  it("Efes antik kenti UNESCO + Müzekart, önemi 1", () => {
    const p = cat({ historic: "archaeological_site", name: "Efes Antik Kenti", wikidata: "Q6" }, EFES)!;
    expect(p.cat).toBe("antik_kent");
    expect(p.tags).toEqual(expect.arrayContaining(["unesco", "muzekart"]));
    expect(p.notability).toBe(1);
    expect(p.visitMin).toBe(180);
  });

  it("Efes Müzesi yalnızca Müzekart; Efes adlı otel ve uzaktaki eşleşmeler etkilenmez", () => {
    const m = cat({ tourism: "museum", name: "Selçuk Efes Müzesi" }, { lat: 37.949, lon: 27.368 })!;
    expect(m.tags).toContain("muzekart");
    expect(m.tags).not.toContain("unesco");
    const h = cat({ tourism: "hotel", name: "Efes Otel" }, EFES)!;
    expect(h.tags).not.toContain("unesco");
    const far = cat({ historic: "archaeological_site", name: "Agora", wikidata: "Q7" }, { lat: 37.85, lon: 27.25 })!;
    expect(far.tags).not.toContain("muzekart");
    const izmirAgora = cat({ historic: "archaeological_site", name: "Agora Ören Yeri" }, { lat: 38.4185, lon: 27.1393 })!;
    expect(izmirAgora.tags).toContain("muzekart");
  });

  it("Hierapolis ve Afrodisias UNESCO; Pamukkale antik havuzu değil", () => {
    expect(cat({ historic: "archaeological_site", name: "Hierapolis" }, { lat: 37.9258, lon: 29.1256 })!.tags).toContain("unesco");
    expect(cat({ historic: "ruins", name: "Afrodisias Antik Kenti" }, { lat: 37.709, lon: 28.724 })!.tags).toContain("unesco");
    const havuz = cat({ tourism: "attraction", name: "Pamukkale Antik Havuz" }, { lat: 37.9257, lon: 29.1263 });
    expect(havuz?.tags ?? []).not.toContain("unesco");
  });
});

describe("çalışma saatleri doğrulaması", () => {
  it("geçersiz ifadeler atılır, PH kuralları korunur", () => {
    expect(validOpeningHours("Mo-Fr 09:00-18:00")).toBe("Mo-Fr 09:00-18:00");
    expect(validOpeningHours("Mo-Su 08:00-19:00; PH off")).toBe("Mo-Su 08:00-19:00; PH off");
    expect(validOpeningHours("sabah 9 akşam 6")).toBeUndefined();
    expect(validOpeningHours("Mo-Xx 09:00-18:00")).toBeUndefined();
    expect(validOpeningHours("")).toBeUndefined();
    expect(cat({ amenity: "cafe", name: "Bozuk Saat Kafe", opening_hours: "her gün açık" })!.openingHours).toBeUndefined();
  });
});

describe("tekilleştirme", () => {
  const mk = (tags: Record<string, string>, at: { lat: number; lon: number }, type: OsmElement["type"] = "node"): Candidate =>
    categorize(el(tags, at, type), EGE_OVERLAY)!;

  it("aynı ad + kategori 60 m içinde: zengin olan kalır, eksikler taşınır", () => {
    const a = mk({ amenity: "cafe", name: "Kordon Çay Bahçesi" }, { lat: 38.42, lon: 27.13 });
    const b = mk({ amenity: "cafe", name: "KORDON ÇAY BAHÇESİ", opening_hours: "Mo-Su 08:00-23:00", website: "https://x.test" }, { lat: 38.4202, lon: 27.1301 }, "way");
    const out = dedup([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0]!.place.id).toBe(b.place.id);
  });

  it("eksik alanlar düşen kopyadan tamamlanır", () => {
    const rich = mk({ tourism: "hotel", name: "Liman Otel", stars: "3", phone: "1", email: "a@b.test" }, { lat: 38.42, lon: 27.13 });
    const poor = mk({ tourism: "hotel", name: "Liman Otel", website: "https://liman.test" }, { lat: 38.4201, lon: 27.1301 });
    const out = dedup([poor, rich]);
    expect(out).toHaveLength(1);
    expect(out[0]!.place.website).toBe("https://liman.test");
  });

  it("uzaktaki aynı adlı şubeler ayrı kalır", () => {
    const a = mk({ amenity: "restaurant", name: "Köfteci Ali" }, { lat: 38.42, lon: 27.13 });
    const b = mk({ amenity: "restaurant", name: "Köfteci Ali" }, { lat: 38.422, lon: 27.13 });
    expect(dedup([a, b])).toHaveLength(2);
  });

  it("aynı wikidata (alan + nokta) birleşir; markalılar birleşmez", () => {
    const area = mk({ historic: "archaeological_site", name: "Nysa", wikidata: "Q8", heritage: "2" }, { lat: 37.9, lon: 28.146 }, "relation");
    const node = mk({ tourism: "attraction", name: "Nysa Antik Kenti", wikidata: "Q8" }, { lat: 37.903, lon: 28.148 });
    expect(dedup([area, node])).toHaveLength(1);
    const s1 = mk({ amenity: "cafe", name: "Zincir Kafe", brand: "Zincir", wikidata: "Q9" }, { lat: 38.42, lon: 27.13 });
    const s2 = mk({ amenity: "cafe", name: "Zincir Kafe Konak", brand: "Zincir", wikidata: "Q9" }, { lat: 38.423, lon: 27.13 });
    expect(dedup([s1, s2])).toHaveLength(2);
  });
});

describe("büyük ören yerleri", () => {
  it("ana yer tekleşir, yarıçaptaki noktalar alt nokta olur", () => {
    const mk = (tags: Record<string, string>, lat: number, lon: number, type: OsmElement["type"] = "way") =>
      categorize(el(tags, { lat, lon }, type), EGE_OVERLAY)!.place;
    const main = mk({ historic: "archaeological_site", tourism: "attraction", heritage: "1", wikidata: "Q47611", name: "Efes" }, 37.941, 27.3425);
    const dup = mk({ tourism: "attraction", name: "Ephesus Ancient City" }, 37.9395, 27.341, "node");
    const theatre = mk({ historic: "archaeological_site", wikidata: "Q15723477", name: "Tiyatro" }, 37.9411, 27.3425, "relation");
    const seven = mk({ tourism: "attraction", historic: "ruins", wikidata: "Q1409276", name: "Yedi Uyuyanlar" }, 37.9437, 27.3536);
    const museum = mk({ tourism: "museum", name: "Efes Deneyimi Müzesi" }, 37.9409, 27.3407);
    const out = applySites([main, dup, theatre, seven, museum], EGE_OVERLAY);
    expect(out.map((p) => p.name)).toEqual(["Efes", "Tiyatro", "Yedi Uyuyanlar", "Efes Deneyimi Müzesi"]);
    const t = out.find((p) => p.name === "Tiyatro")!;
    expect(t.cat).toBe("tarihi_yapi");
    expect(t.note).toMatch(/Efes/);
    expect(t.notability).toBeLessThanOrEqual(0.2);
    expect(out.find((p) => p.name === "Yedi Uyuyanlar")!.note).toBeUndefined();
    expect(main.tags).toEqual(expect.arrayContaining(["unesco", "muzekart"]));
    expect(main.priceForeign?.currency).toBe("EUR");
  });
});

describe("kasabalar ve paket", () => {
  const towns: OsmElement[] = [
    el({ place: "city", name: "İzmir", population: "4.462.056" }, IZMIR),
    el({ place: "town", name: "Selçuk" }, { lat: 37.9507, lon: 27.3686 }),
    el({ place: "village", name: "Şirince" }, { lat: 37.9436, lon: 27.4339 }),
    el({ place: "village", name: "Sıradan Köy" }, { lat: 38.0, lon: 27.8 }),
    el({ place: "suburb", name: "Alsancak" }, { lat: 38.437, lon: 27.143 }),
    el({ place: "suburb", name: "Rastgele Mahalle" }, { lat: 38.44, lon: 27.15 }),
  ];

  it("il/ilçe merkezleri hep, köy/mahalle yalnızca kürasyonla", () => {
    const out = buildTowns(towns, [], EGE_OVERLAY, REGIONS.ege!.bbox);
    const names = out.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["İzmir", "Selçuk", "Şirince", "Alsancak"]));
    expect(names).not.toContain("Sıradan Köy");
    expect(names).not.toContain("Rastgele Mahalle");
    const izmir = out.find((t) => t.name === "İzmir")!;
    expect(izmir).toMatchObject({ id: "izmir", kind: "city", population: 4462056 });
    expect(out.find((t) => t.name === "Alsancak")!.kind).toBe("town");
  });

  it("paket şemaya uyar, komşu ülke öğeleri elenir", () => {
    const greek = el({ amenity: "restaurant", name: "Taverna Samos" }, { lat: 37.75, lon: 26.97 });
    const local = el({ amenity: "restaurant", name: "Selçuk Köftecisi" }, { lat: 37.95, lon: 27.37 });
    const { pack, stats } = assemblePack(
      REGIONS.ege!,
      {
        region: "ege",
        bbox: REGIONS.ege!.bbox,
        fetchedAt: "2026-10-24T00:00:00Z",
        groups: { yeme: [greek, local], yerlesim: towns, yabanci: [{ type: "node", id: greek.id }] },
      },
      EGE_OVERLAY,
      new Date("2026-10-24T12:00:00Z"),
    );
    expect(stats.excluded).toBe(1);
    expect(pack.places.map((p) => p.name)).toEqual(["Selçuk Köftecisi"]);
    expect(pack.version).toBe("2026.10.24");
    expect(pack.attribution).toMatch(/ODbL/);
    expect(() => RegionPackSchema.parse(pack)).not.toThrow();
  });
});
