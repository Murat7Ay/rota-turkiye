# @rota/data — bölge paketleri

OpenStreetMap verisini (Overpass API) Rota Türkiye'nin çevrimdışı "bölge paketlerine" çevirir.
Çıktı: `apps/web/public/packs/<bölge>.json` (küçültülmüş `RegionPack`) ve `apps/web/public/packs/index.json`.

## Paket üretmek

```sh
pnpm --filter @rota/data build-pack ege            # önbellek varsa onu kullanır
pnpm --filter @rota/data build-pack ege --refresh  # Overpass'tan yeniden indirir
pnpm --filter @rota/data build-pack all            # ege, kapadokya, istanbul-tarihi (sırayla)
pnpm --filter @rota/data build-pack ege --offline  # Overpass'a gitmeden, önbellekte ne varsa onunla
```

Overpass yoğunken bölge 0,5°'lik karolara bölünür ve her karo önbelleğe yazılır; `--offline` yarım
kalmış grupların bitmiş karolarını da kullanır. Yerleşim sorgusu eksik kalırsa `src/curated/ege.ts`
içindeki elle girilmiş kasaba merkezleri (`fallbackTowns`) devreye girer; komşu ülke öğeleri ayrıca
`excludeBoxes` kutularıyla elenir.

- Bölgeler `src/regions.ts` içinde (`id`, `name`, `bbox [minLon, minLat, maxLon, maxLat]`).
- Ham Overpass yanıtları `packages/data/.cache/<bölge>.json` dosyasına yazılır (git'e girmez).
  Sorgular gruplara bölünür (gezi, ibadet_carsi, doga, yeme, alisveris, konaklama, yerlesim, yabanci);
  her grup bitince önbellek kaydedilir, yarıda kalan çalıştırma kaldığı yerden sürer.
- Overpass'a nazik davranılır: `rota-turkiye/0.1` User-Agent, bölgeler ve gruplar sırayla,
  429/5xx'te artan bekleme, yedek uç (`overpass.kumi.systems`), zaman aşımında kutu dörde bölünür.
- Kutuya giren komşu ülke toprakları (Ege'de Sisam, İkarya gibi Yunan adaları) `yabanci` grubuyla
  OSM sınırından bulunup elenir.
- Paket, `src/schema.ts` içindeki zod şemasıyla (çekirdek `Place`/`Town`/`RegionPack` türlerinin
  aynası) doğrulanmadan yazılmaz.

## Sınıflandırma kuralları (`src/categorize.ts`)

Adlar Türkçe küçük harfe çevrilip aksanlardan arındırılır ("Çay Bahçesi" → "cay bahcesi"), kurallar bu
biçim üzerinde çalışır. İlk tutan kural kazanır:

| Kategori | Kural |
| --- | --- |
| otel / butik_otel / pansiyon / kamp | `tourism=hotel|motel` / adında "butik" / `guest_house|hostel|chalet` / `camp_site` (`stars` → fiyat kademesi) |
| dinlenme_tesisi | `highway=services|rest_area` ya da adında "dinlenme tesisi" |
| pazar / carsi | `amenity=marketplace`; adı çarşı/bedesten/arasta olup tarihi/miras/wikidata ise `carsi` |
| meyhane | adında meyhane/taverna (alkol: evet) |
| cay_bahcesi | adında çay bahçesi/çay ocağı/çay evi/semaver (OSM'de etiketi yok) |
| kahvehane | kıraathane, kahvehane, köy kahvesi |
| esnaf_lokantasi | lokanta, ev yemekleri, esnaf, sulu/hazır yemek, `cuisine=home_cooking` |
| kahvalti | kahvaltı, serpme, `cuisine=breakfast` |
| balikci | balık/balıkçı, `cuisine=seafood|fish` ("Balıkesir" sayılmaz) |
| kebapci | kebap, ocakbaşı, ciğer, döner, köfte, kokoreç, `cuisine=kebab…` |
| pideci | pide, lahmacun, gözleme, etli ekmek |
| tatlici | `shop=pastry|confectionery|chocolate`, `amenity=ice_cream`, baklava/künefe/muhallebi/lokum/dondurma/pastane… |
| firin | `shop=bakery`, simit/gevrek/boyoz/börek/poğaça |
| kafe / restoran | kalan `amenity=cafe` / `restaurant`; `fast_food` yalnızca Türk mutfağıysa |
| yoresel_urun | `shop=farm|cheese|honey|olive_oil`; şarküteri/baharat/çay/kahve dükkânı yalnızca adı yöresel/köy ürünü/zeytin… ise; şarap yalnızca Urla ve Şirince bağ bölgelerinde |
| hediyelik | `shop=souvenir` |
| antik_kent / tarihi_yapi | `historic=archaeological_site` (öne çıkan ya da adı "antik kent/ören yeri" ise antik kent), kale, sur kapısı, kervansaray, türbe… |
| muze, cami, manzara, plaj, dogal_alan | `tourism=museum`, tarihi/wikidata'lı camiler, `viewpoint`, `natural=beach`, şelale/mağara/kaplıca/tabiat parkı/milli park |

Ek kurallar: uluslararası zincirler (McDonald's, Starbucks, KFC…) hiç alınmaz; markalı yerli zincirler
alınır ama `yerel` etiketi almaz ve önemi 0,1 düşer. Esnaf lokantası, çay bahçesi, kahvehane ve semt
pazarı `yerel` etiketi alır. 1960 öncesi kuruluş (`start_date`) ya da adda "Tarihi"/"18xx'den beri" →
`tarihi`. Önem (0..1): taban 0,1 + wikidata/wikipedia 0,35 + miras 0,25 + tarihi 0,15 + `tourism=attraction`
0,1 + çalışma saati 0,05 + web sitesi 0,03.

Geçersiz `opening_hours` ifadeleri atılır (çekirdekteki `hours.ts` ile aynı ayrıştırıcı). Semt pazarının
saati yoksa planlanmaz; adındaki gün yalnızca not olarak yazılır, saat uydurulmaz.

Tekilleştirme: aynı ad + aynı kategori 60 m içinde ya da aynı wikidata 1,5 km içinde → etiketi çok olan
kalır, eksik alanlar (saat, web, wikidata) ondan tamamlanır. Koordinatlar 5 basamağa yuvarlanır;
kimlikler `osm:n…`, `osm:w…`, `osm:r…`.

## Kürasyon katmanı (`src/curated/`)

Elle doğrulanmış, kontrol edilebilir bilgiler: UNESCO (Efes, Hierapolis-Pamukkale, Afrodisias; Göreme;
İstanbul Tarihi Alanları), Bakanlığa bağlı Müzekart geçerli ören yeri/müzeler, bağ bölgeleri ve
kasaba listesine alınacak köyler (Şirince, Alaçatı, Birgi…). Bir kayıt ad + kategori + konum (yarıçap)
üçü birden tuttuğunda uygulanır. Fiyat yalnızca kaynak URL'si olan gerçek gözlemle eklenir; yoksa
uygulama kategori tahminini "tahmini" etiketiyle gösterir.

## Kasabalar

`place=city|town` hep; köyler kürasyon listesindeyse ya da wikidata'lı olup 1,5 km çevresinde en az 6
gezi/konaklama mekânı varsa; mahalleler (`suburb`) yalnızca kürasyon listesindeyse alınır.

## Lisans (ODbL)

Paketler OpenStreetMap verisinden türetilmiş bir veritabanıdır ve **ODbL 1.0** ile yayımlanır.
Her pakette `attribution: "© OpenStreetMap katkıcıları — ODbL 1.0"` alanı bulunur; uygulama bu atfı
göstermelidir. Paketleri başka verilerle birleştirip yayımlarsanız birleşik veritabanı da ODbL ile
paylaşılmalıdır. Ayrıntı: <https://www.openstreetmap.org/copyright>.

## Test

```sh
pnpm --filter @rota/data test   # categorize.test.ts (kurallar) + pack.test.ts (ege.json varsa)
```
