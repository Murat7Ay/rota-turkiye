# Rota Türkiye

**Türkiye'ye özel, açık kaynak, çevrimdışı çalışan gezi planlayıcı.** Rotanı çizer; nerede kahvaltı yapacağını, öğle yemeğini nerede yiyeceğini, çayı nerede içeceğini, nereden alışveriş yapacağını ve geceyi nerede geçireceğini her sabah bir tur rehberi gibi söyler. Plan bozulunca (atladın, geç kaldın, mekân kapalıydı, yağmur başladı, bütçe aştı) günü baştan yazmadan **onarır**. Yolda giderken rotanın birkaç kilometre yakınındaki antik kenti ya da tarihi tatlıcıyı **haber verir**. Reklam yok, sponsorlu listeleme yok, hesap yok.

🌐 Canlı demo: https://murat7ay.github.io/rota-turkiye/

> English: Rota Türkiye is an open-source, offline-first trip planner for Türkiye. It builds day-by-day plans (breakfast, lunch, tea, shopping, dinner, hotel), repairs them in place when things go wrong, notifies you about notable places just off your route, and tracks your budget against the plan. Everything runs in the browser; no ads, no accounts.

## Ne yapıyor

| Özellik | Nasıl |
|---|---|
| **Gün çözücü** | Her gün, zaman pencereli ve ödül toplayan bir TSP (orienteering) olarak çözülür. Öğünler "N adaydan tam biri" yuvaları, gezi durakları isteğe bağlı ödüllü düğümler. Çalışma saatleri, namaz vakitleri (camiler), bayramın ilk günü kapanan çarşılar, haftanın belli günü kurulan pazarlar sert kısıt. |
| **Sabah rehberi** | Günde tek bildirim: rota, hava (Open-Meteo), dört yuva, takvim uyarıları, günlük harcama limiti ve bir B planı. Metin şablondan üretilir; internet ve LLM gerekmez. |
| **Plan onarımı** | "Atla / geç kaldım / kapalıydı / yağmur / bütçe aştı" olayında yapılan duraklar kilitlenir, kalan gün şu anki konum ve saatten yeniden çözülür, 2–3 farklı seçenek sunulur. |
| **Yol üstü keşif** | Plan sırasında rota koridorundaki değerli yerler önerilir; yolculuk sırasında konuma göre "İleride: Nysa Antik Kenti · 12 km sonra · ~5 dk sapma" bildirimi gelir. Günlük limit, sessiz saatler, bekleme süresi var; geçilmiş yerler bildirilmez. |
| **Etrafım** | Konumunun çevresini izometrik, dairesel bir 3B "diorama" içinde gösterir; çevredeki öne çıkan yerler açık/kapalı durumu ve yönüyle listelenir. |
| **Bütçe motoru** | Planlanan ile gerçek harcama karşılaştırılır; aşım varsa çözücüye "bütçe baskısı" olarak geri beslenir ve ertesi günün önerileri ucuzlar. Kur kayıt anında dondurulur, TL fiyatlar aylık enflasyonla endekslenir, Müzekart / Museum Pass başabaş hesabı yapılır. |
| **Türkiye kategorileri** | Çay bahçesi, esnaf lokantası, kahvehane, tatlıcı, semt pazarı, yöresel ürün… OSM'de etiketi olmayanlar ad sezgileriyle bulunur. |

## Mimari

```
packages/core   Saf TypeScript motorlar (çözücü, onarım, keşif, bütçe, brifing, takvim, saatler)
packages/data   OpenStreetMap (Overpass) → Türkiye kategorileri → bölge paketi (JSON, ODbL)
apps/web        Vite + React + MapLibre GL + PWA; her şey tarayıcıda, IndexedDB'de
infra/osrm      İsteğe bağlı kendi rota sunucun (Docker)
```

- **Sunucusuz:** Planlama, onarım ve keşif tarayıcıda çalışır; uygulama GitHub Pages'te bedava barınır ve çevrimdışı açılır.
- **Açık veri:** Mekânlar OpenStreetMap'ten (ODbL), harita OpenFreeMap'ten, hava Open-Meteo'dan, rota OSRM'den.
- **Kişisel veri sunucuya gitmez:** Gezi, harcama ve konum cihazda kalır.

Neden böyle olduğu `reports/` altındaki araştırma raporunda: rakip analizi, veri kaynakları, hukuk/KVKK ve yol haritası.

## Çalıştırma

```bash
pnpm install
pnpm dev                 # http://localhost:5173
pnpm test                # bütün paketlerin birim testleri
pnpm data:ege            # Ege paketini OSM'den yeniden üret
```

Kendi rota sunucun için `infra/osrm/docker-compose.yml` dosyasındaki adımlara bak.

## Test stratejisi

- **Altın testler** (`packages/core/test`): "Topkapı salı günü planlanmaz", "öğle yuvası boş kalmaz", "cuma namazında cami yok", "pazar yeri sadece kurulduğu gün", "Afrodisias 40 km sapmada, yol üstü sayılmaz" gibi kurallar sözleşmedir.
- **Veri testleri** (`packages/data/test`): kategori kuralları el yapımı OSM örnekleriyle; üretilen paket şema ile doğrulanır.
- **Arayüz:** tip kontrolü + üretim derlemesi; uçtan uca kontrol tarayıcıda yapılır.
- Testler en fazla 2 işçiyle koşar; ağır doğrulama CI'da (GitHub Actions) yapılır.

## Lisans

- Kod: [AGPL-3.0](LICENSE)
- Bölge paketleri: OpenStreetMap türevi, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) — © OpenStreetMap katkıcıları
