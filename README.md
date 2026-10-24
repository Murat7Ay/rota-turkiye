# Rota Türkiye

**Türkiye'ye özel, açık kaynak, çevrimdışı çalışan gezi planlayıcı.** Rotanı çizer; nerede kahvaltı yapacağını, öğle yemeğini nerede yiyeceğini, çayı nerede içeceğini, nereden alışveriş yapacağını ve geceyi nerede geçireceğini her sabah bir tur rehberi gibi söyler. Plan bozulunca (atladın, geç kaldın, mekân kapalıydı, yağmur başladı, bütçe aştı) günü baştan yazmadan **onarır**. Yolda giderken rotanın birkaç kilometre yakınındaki antik kenti ya da tarihi tatlıcıyı **haber verir**, istersen sesli söyler. Reklam yok, sponsorlu listeleme yok, hesap yok.

🌐 Canlı: https://murat7ay.github.io/rota-turkiye/

> **English:** Rota Türkiye is an open-source, offline-first trip planner for Türkiye. It builds day-by-day plans (breakfast, lunch, tea, shopping, dinner, hotel) with a constraint solver, repairs them in place when things go wrong, notifies you (optionally by voice) about notable places just off your route, and tracks your budget against the plan. Everything runs in the browser — no backend, no ads, no accounts. Optional AI features use your own Claude API key directly from the browser.

## Özellikler

### Planlama ve yolculuk
| | |
|---|---|
| **Gün çözücü** | Her gün zaman pencereli, ödül toplayan bir TSP (orienteering) olarak çözülür. Öğünler "N adaydan tam biri" yuvaları, gezi durakları ödüllü düğümler. Çalışma saatleri, namaz vakitleri (camiler), bayramın ilk günü kapanan çarşılar, haftanın belli günü kurulan pazarlar sert kısıt. Efes, Hierapolis gibi "mutlaka görülmeli" yerler uzun ziyaretleriyle korunur. |
| **Sabah rehberi** | Günde tek bildirim: rota, hava (Open-Meteo), kahvaltı/öğle/çay/akşam/otel, takvim uyarıları, günlük harcama limiti ve bir B planı. Şablondan üretilir; internet ve LLM gerekmez. |
| **Plan onarımı** | "Atla / geç kaldım / kapalıydı / yağmur / bütçe aştı / alternatifle değiştir" olayında yapılan duraklar kilitlenir, kalan gün şu anki konum ve saatten yeniden çözülür, 2–3 farklı seçenek sunulur. |
| **Yol üstü keşif** | Plan sırasında rota koridorundaki değerli yerler önerilir; yolculukta konuma göre "İleride: Nysa Antik Kenti · 12 km sonra · ~5 dk sapma" bildirimi gelir. Günlük limit, sessiz saatler, bekleme süresi var; geçilmiş yerler bildirilmez. Masaüstünde **simülasyon** ile denenebilir. |
| **Şimdi ne yapsam?** | Konum, saat, hava ve kalan bütçeye göre önümüzdeki 1–3 saat için 3 farklı mini plan. |
| **Altın saat** | Gün batımına göre en iyi manzara noktası ve ne zaman orada olman gerektiği. |
| **Sesli rehber** | Sabah rehberi ve yol üstü uyarılar Türkçe sesle (Web Speech, cihazdaki Türkçe ses; çevrimdışı). |
| **Etrafım** | Konumunun çevresini izometrik, dairesel bir 3B "diorama" içinde gösterir; çevredeki öne çıkan yerler açık/kapalı durumu ve yönüyle. |
| **Rota uçuşu** | Günün rotası üstünde 3B kamera uçuşu (reels için). |
| **Çevrimdışı gezi paketi** | Rota koridorunun harita karoları, stil ve bölge paketi önceden indirilir. |

### Bütçe ve güven
| | |
|---|---|
| **Bütçe motoru** | Planlanan ile gerçek harcama karşılaştırılır; aşım "bütçe baskısı" olarak çözücüye geri beslenir. Kur kayıt anında dondurulur (TCMB/ECB), TL fiyatlar aylık enflasyonla endekslenir, Müzekart / Museum Pass başabaş hesabı yapılır. |
| **Hesap kontrol** | Servis/kuver/masa ücreti satırlarını yakalar (30 Ocak 2026'dan beri yasak), tutarı mekânın tahminiyle kıyaslar. |
| **Türkiye bilgi katmanı** | TÜRKPATENT tescilli 109 coğrafi işaretli ürün ("Bugün Aydın'dan geçiyorsun: Aydın inciri…"), kaynaklı turist tuzağı uyarıları, görgü kuralları. |
| **Türkiye kategorileri** | Çay bahçesi, esnaf lokantası, kahvehane, tatlıcı, semt pazarı, yöresel ürün… OSM'de etiketi olmayanlar ad sezgileriyle bulunur. |

### Paylaşım ve oyun
| | |
|---|---|
| **Sunucusuz paylaşım linki** | Plan deterministik: istek + tohum linke gömülür, karşı taraf aynı planı kendi cihazında yeniden kurar. |
| **Hikâye kartı ve Gezi Wrapped** | Günün ve gezinin 1080×1920 paylaşılabilir özeti. |
| **Türkiye Pasaportu** | Damgalar (Çay Ustası, Antik Kent Avcısı, Esnaf Lokantası Müdavimi…) ve 81 il haritası. |

### İsteğe bağlı yapay zekâ (kendi anahtarınla)
"Kasımda 4 gün Ege, Selçuk'ta 2 gece…" gibi serbest metinden gezi isteği, sabah rehberini rehber ağzından anlatma ve "Rehbere sor". **LLM önerir, çözücü karar verir:** saatleri ve sırayı her zaman çözücü üretir; yapay zekâ yalnızca isteği anlar ve anlatır. Anahtar yalnızca cihazda saklanır, istekler doğrudan Anthropic'e gider.

## Mimari

```
packages/core   Saf TypeScript motorlar: çözücü, onarım, keşif, bütçe, brifing, takvim/saatler,
                şimdi, güneş, paylaşım, damgalar, bilgi katmanı, AI istemcisi
packages/data   OpenStreetMap (Overpass) → Türkiye kategorileri → bölge paketi (JSON, ODbL)
apps/web        Vite + React + MapLibre GL + PWA; planlama bir Web Worker'da, veri IndexedDB'de
infra/osrm      İsteğe bağlı kendi rota sunucun (Docker)
```

- **Sunucusuz:** Planlama, onarım ve keşif tarayıcıda çalışır; uygulama GitHub Pages'te bedava barınır ve çevrimdışı açılır.
- **Açık veri:** Mekânlar OpenStreetMap'ten (ODbL), harita OpenFreeMap'ten, hava Open-Meteo'dan, rota OSRM'den.
- **Kişisel veri sunucuya gitmez:** Gezi, harcama ve konum cihazda kalır.

Tasarım kararlarının gerekçesi `reports/` altındaki araştırma raporunda: rakip analizi, veri kaynakları, hukuk/KVKK, yol haritası.

## Çalıştırma

```bash
pnpm install
pnpm dev                 # http://localhost:5173
pnpm test                # bütün paketlerin birim testleri
pnpm smoke               # gerçek Ege paketiyle uçtan uca planlama denemesi
pnpm --filter @rota/data smoke kapadokya          # ya da istanbul-tarihi
pnpm data:ege            # Ege paketini OSM'den yeniden üret
```

Kendi rota sunucun için `infra/osrm/docker-compose.yml` dosyasındaki adımlara bak.

## Test stratejisi

- **Altın testler** (`packages/core/test`, 130+ test): "Topkapı salı günü planlanmaz", "öğle yuvası boş kalmaz", "cuma namazında cami yok", "pazar yeri sadece kurulduğu gün", "Afrodisias 40 km sapmada, yol üstü sayılmaz", "aynı istek + tohum = aynı plan" gibi kurallar sözleşmedir.
- **Veri testleri** (`packages/data/test`): kategori kuralları el yapımı OSM örnekleriyle; üretilen paket şema ile doğrulanır.
- **Duman testi** (`pnpm smoke`): gerçek pakette 3 günlük plan + yol üstü keşif + brifing + onarım.
- **Arayüz:** tip kontrolü + üretim derlemesi; görsel kontrol tarayıcıda.
- Testler en fazla 2 işçiyle koşar; ağır doğrulama GitHub Actions'ta yapılır.

## Bilinen sınırlar

- Üç bölge var: **Ege** (İzmir – Efes – Pamukkale, 4.358 yer), **Kapadokya** (Göreme – Ürgüp – Ihlara, 909 yer), **İstanbul** (Tarihi Yarımada – Beyoğlu – Kadıköy – Üsküdar, 6.532 yer). Yeni bölge: `packages/data/src/regions.ts` + kürasyon katmanı + `pnpm --filter @rota/data build-pack <bölge>`.
- OSM'de çalışma saati olan mekân oranı düşük; uygulama bunu "çalışma saati doğrulanmadı" diye açıkça söyler.
- Fiyatların çoğu kategori modeli tahminidir ve "tahmini" etiketiyle gösterilir; gerçek fişler geldikçe iyileşir.
- Arka planda konum bildirimi tarayıcıda yalnızca uygulama açıkken çalışır; kalıcı arka plan için yerel paketleme (Capacitor) sonraki adım.

## Lisans

- Kod: [AGPL-3.0](LICENSE)
- Bölge paketleri: OpenStreetMap türevi, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap katkıcıları
- Coğrafi işaret verileri: TÜRKPATENT kayıtlarına bağlantılı, açıklamalar özgün özettir.
