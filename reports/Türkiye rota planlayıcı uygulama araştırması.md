# Sabah rehberi ve plan onarımıyla rakipleri geçmek

GoTürkiye'yi ve öteki uygulamaları geçmenin yolu yapay zekâyla gezi planı üretmek değil. Bunu artık Google'dan Routevia'ya herkes yapıyor. Kazandıracak olan, **gün içinde bozulan planı yerinde onaran bir rehber** ile **Türkiye'ye özgü, güvenilir bir yerel veri katmanını** aynı uygulamada birleştirmek. İncelenen rakiplerin hiçbiri (Google Ask Maps, Yandex, Wanderlog, Mindtrip, GoTürkiye, Routevia, Optiviser) "öğle yemeğini atladın, yakında açık bir esnaf lokantası var, bütçene de uyuyor" diyerek günün geri kalanını yeniden kurmuyor. Sohbet tabanlı planlayıcılar ise test edilen planların **%24'ünde kapalı mekân**, yaklaşık **yarısında kapalı saate ziyaret** öneriyor ([Travolution](https://travolution.com/news/marketing/survey-finds-chatgpt-itineraries-to-be-riddled-with-inaccuracies)). Doğru mimari "LLM önerir, solver karar verir". GPT-4 tek başına TravelPlanner testinde **%0,6** başarı alıyor; kısıt çözücüyle desteklenen sistemler **%90'ın üstüne** çıkıyor ([arXiv 2402.01622](https://arxiv.org/abs/2402.01622); [arXiv 2404.11891](https://arxiv.org/abs/2404.11891)). Veri tarafında Overture, Foursquare OS Places ve OSM birleştirilince Türkiye için **yaklaşık 2,2 milyon nokta** bedavaya geliyor ([Zenodo AnythingPOI](https://zenodo.org/records/20013733)). Bu verinin zayıf olduğu yer çalışma saatleri ve kalite sinyali; fark da tam orada, elle kürate edilen katmanlarla yaratılacak: esnaf lokantası, çay bahçesi, pazar günleri, Michelin ve Gault&Millau, coğrafi işaret, müze ücretleri ve kapanış günleri. Bu yığınla altyapı ayda **100 aktif kullanıcıda yaklaşık 8–55 $, 10.000'de 200–1.700 $** tutuyor. Aradaki farkı neredeyse tamamen LLM model seçimi belirliyor; yani ucuz model varsayılan olmalı, kota da zorunlu. Üç büyük risk var: Google'ın Ask Maps'i Türkiye'de Türkçe açması, 1 Ağustos 2026'dan beri doğrulanmamış yorum yayınlamayı yasaklayan reklam yönetmeliği ve uygulama halka açılınca devreye girecek KVKK yurt dışı aktarım yükümlülükleri. Başlangıç noktası net: tek bölge, tek kullanıcı (sen), tek gerçek gezi. İlk yapılacaklar gün çözücü, sabah rehberi, "atla / geç kaldım / kapalıydı" butonları ve TL harcama defteri.

## Rakiplerin hiçbiri gün içinde bozulan planı onarmıyor

En güçlü rakip Google, ama Türkiye'de henüz yarım. Gemini tabanlı **Ask Maps, 12 Mart 2026'da yalnızca ABD ve Hindistan'da** açıldı. Çok duraklı bir yol gezisini gün gün planlıyor, durak bilgisi ve gişe bilgisi veriyor ([PCWorld](https://www.pcworld.com/article/3086987/gemini-just-became-your-new-google-maps-buddy.html)). Haziran 2026'da adı verilmeyen "birkaç pazara" yayıldı ama Türkiye anılmıyor. Rota içindeki "trafiğe girmemek için ne zaman çıkayım" türü öneri baloncukları Temmuz 2026 itibarıyla hâlâ deneysel ([Ubergizmo](https://www.ubergizmo.com/2026/07/google-maps-gets-ask-maps-gemini-ai-to-plan-your-travels/)). Arama'daki AI Mode "Canvas" planlayıcısı da ABD'de, Labs'e katılmış masaüstü kullanıcılarıyla sınırlı ([Search Engine Journal](https://www.searchenginejournal.com/google-extends-ai-travel-planning-and-agentic-booking-in-search/)). Ekim 2026 itibarıyla Google'ın Türkiye'de Türkçe, çok günlü planlama sunduğunu gösteren bir kaynak yok. Yine de yer grafiği, canlı trafik ve yorum verisi elinde; bunu açtığı gün en büyük tehdit o olur. Google'ın Türkiye'deki asıl zaafı güven. Turistik bölgelerdeki şişirilmiş puanlar Reddit'te düzenli şikâyet konusu ([r/istanbul](https://axebps-redlib.hf.space/r/istanbul/s/D8rThSu7Fg)). Google 2025'te dünya genelinde **292 milyon** kural ihlali içeren yorumu engelledi ya da kaldırdı ([Google](https://blog.google/products-and-platforms/products/maps/new-ways-were-protecting-businesses-on-maps/)). Trendyol Yemek'te de bazı restoranların kendilerine su ya da ayran sipariş edip 5 yıldız verdiği ortaya çıktı ([Webtekno](https://www.webtekno.com/trendyol-sahte-yorum-restoran-puani-h130315.html)).

Türkçe tarafta izlenmesi gereken oyuncu Yandex. Ağustos 2026'da Yandex Haritalar ve Navi'ye Türkçe ve İngilizce sohbetle mekân arama geldi. "Sessiz", "açık hava", "şu saatte" gibi kısıtları anlıyor ve araçla, toplu taşımayla ya da yürüyerek yol tarifi veriyor. Ancak haberde çok duraklı ya da çok günlü plan geçmiyor ([Teknoblog](https://www.teknoblog.com/yandex-haritalar-yapay-zeka-ile-rota-hazirliyor/)). Yandex AI uygulamasındaki "Trip AI Agent"in canlı trafikle çok duraklı rota ve bütçe tahmini yaptığı iddiası ise yalnızca bir ürün yöneticisinin LinkedIn paylaşımına dayanıyor ([LinkedIn](https://tr.linkedin.com/in/kurtb)). Bu iddiayı düşük güvenle okumak gerekiyor.

Klasik planlayıcılar "liste + harita + ortak düzenleme" üçlüsünde takılı kalmış. Üstelik en çok şikâyet aldıkları özelliği parayla satıyorlar. Wanderlog'da çevrimdışı erişim yıllık **39,99 $'lık Pro** paketinde ([Endless Travel Plans](https://www.endlesstravelplans.com/guides/planning-tools/wanderlog-review)). Trustpilot'ta kullanıcılar habersiz yenilemeden, Premium'un yalnızca ödeyen kişiye açılmasından ve senkron hatalarından şikâyetçi ([Trustpilot](https://trustpilot.com/review/wanderlog.com)). Tripomatic'te de çevrimdışı harita ve AI planlama Premium'un arkasında ([App Store](https://apps.apple.com/app/tripomatic/id519058033)). Duraklı yol gezisi fikrine en yakın ürün Roadtrippers; üçüncü taraf bir incelemeye göre yalnızca ABD, Kanada, Avustralya ve Yeni Zelanda'yı kapsıyor ([PilotPlans](https://pilotplans.com/blog/roadtrippers-review)). Yani 81 illik yol gezisi alanı açık. Online seyahat acenteleri (OTA'lar) ise planlamayı rezervasyona hizmet eden bir huni olarak görüyor. Booking.com'un geliştirdiği planlayıcı, dönüşümü bozmayacak şekilde rezervasyon adımından yukarı doğru kurgulanıyor ([Skift](https://skift.com/?p=838262)). Expedia ise Layla'yı satın aldı ([Travolution](https://www.travolution.com/news/travel-sectors/intermediaries/expedia-group-acquires-layla-to-accelerate-ai-trip-planning/)). Ticari çıkarı olmayan bir uygulama çay bahçesini, semt pazarını, esnaf lokantasını ve bedava manzara noktasını öne çıkarabilir. Bir OTA'nın bunu yapması için hiçbir teşviki yok.

AI tabanlı planlayıcıların ortak zaafı, planı gerçeklikle doğrulamamak. SEO Travel, ChatGPT'ye 10 şehirde plan yaptırdığı çalışmada şu sonuçları buldu ([Travolution](https://travolution.com/news/marketing/survey-finds-chatgpt-itineraries-to-be-riddled-with-inaccuracies)):

- Planların **%90'ında en az bir hata** vardı.
- %24'ünde kapalı mekân önerildi.
- Yaklaşık yarısında ziyaret kapalı saate konmuştu.
- Dörtte birinde gereksiz geri dönüşler vardı.

Çalışma küçük, tek bir modelle ve sipariş üzerine yapılmış. Yine de ölçtüğü hatalar, kullanıcıların sahada yaşadığı hataların ta kendisi. Mindtrip uçuş ve otel rezervasyonuna yöneldi ([Sabre](https://investors.sabre.com/node/19876)). Ama incelenen hiçbir ürün, atlanan ya da geç kalınan bir durakta kalan günü saatlere, mesafeye ve bütçeye göre yeniden kurmuyor. Bütçe de hepsinde planlama anındaki bir tahminden ibaret; yolculuk boyunca gerçek harcamayı izleyip öneriyi buna göre değiştiren yok.

Türkiye'ye özel ürünler beklenenden zayıf. GoTürkiye, 81 ili ve tematik turizmi kapsayan, ayda 3 milyon ziyaretçi iddia eden resmi bir içerik platformu. Ama basın bülteninde harita, rezervasyon ya da yapay zekâ özelliği geçmiyor ([GoTürkiye](https://goturkiye.com/branding/press-releases/global-tourism-information-platform-of-turkiye)). iOS uygulamasının son sürümü **3 Temmuz 2024 tarihli v1.1.0**, puan gösterecek kadar değerlendirmesi bile yok ([App Store](https://apps.apple.com/us/app/-/id6478965187)). Bu yüzden GoTürkiye bir rakip değil, bağlantı verilecek bir içerik kaynağı. 2025–26'da çıkan doğrudan rakipler küçük ve henüz kendini kanıtlamamış:

- **Routevia** 81 ilde gün gün AI planı yapıyor. Product Hunt'ta sıfır oyu var ve tanıtımında restoran, otel, bütçe ya da yeniden planlamadan söz edilmiyor ([Hunted.space](https://hunted.space/product/routevia)).
- **Optiviser Trip** reklam içeriyor ve otellerle restoranların kendi bilgilerini eklediği bir işletme paneli sunuyor ([App Store](https://apps.apple.com/mx/app/optiviser-trip/id6753893275)). Bu, reklamsız ve sponsorlu listelemesiz bir uygulamaya hazır bir güven farkı bırakıyor.

Enuygun'un 2025'te açtığı MCP sunucusu uçak, otel, otobüs ve araç kiralama aramasını LLM'lere açıyor ([Webrazzi](https://webrazzi.com/2025/08/08/yapay-zeka-destekli-seyahat-deneyimi-enuygun-com-un-seyahat-mcp-sunucusu/)). Şehirlerarası otobüsün Türkiye'deki ağırlığı düşünülünce bu, global planlayıcılarda olmayan bir ulaşım katmanı. Michelin ve Gault&Millau güvenilir ama dar kapsamlı. Michelin dört bölgeyi kapsıyor: İstanbul, İzmir, Muğla ve Kapadokya. Gault&Millau ise 11 ili kapsıyor ([Michelin](https://guide.michelin.com/gb/en/article/michelin-guide-ceremony/the-michelin-guide-turkiye-reveals-its-2026-restaurant-selection); [Euronews TR](https://tr.euronews.com/kultur/2025/12/12/turk-mutfagi-dunya-sahnesinde-gaultmillau-2026-odulleri-aciklandi)). 81 ilin çoğunda, esnaf lokantası, çay bahçesi, kahvaltı salonu ve pazar gibi gündelik kategorilerde uzman kürasyonu hiç yok. Asıl boşluk bu.

| Rakip | İyi yaptığı | Türkiye'de açık bıraktığı yer |
|---|---|---|
| Google Maps + Ask Maps | Yer grafiği, canlı trafik, gün gün yol gezisi | Türkiye'de ve Türkçe açıldığı doğrulanmadı; turistik bölgelerde yorumlara güven zayıf |
| Yandex Haritalar / Navi | Türkçe sohbetle mekân arama | Çok duraklı, çok günlü plan yok |
| Wanderlog, Tripomatic | Liste, harita, ortak düzenleme | Çevrimdışı mod ücretli; plan statik |
| Roadtrippers | Duraklı yol gezisi | Türkiye'yi kapsamıyor |
| Booking, Expedia/Layla, Mindtrip | AI taslak ve rezervasyon | Kendi envanterine yönlendiriyor; ucuz ve yerel seçenekler görünmüyor |
| Genel sohbet botları | Hızlı ilk taslak | Kapalı mekân ve kapalı saat hataları |
| GoTürkiye | Resmi içerik, 81 il, 10 dil | Uygulama 2024 ortasından beri güncellenmedi; harita, AI ve canlı veri yok |
| Routevia, Optiviser | Türkiye'ye özel AI gün planı | Kullanıcı tabanı yok; reklam ve ücretli listeleme var; plan onarımı ve bütçe takibi yok |

## Kazandıracak yedi özellik belli, gerisi masaya oturma bedeli

Bazı özellikler 2026'da artık masaya oturma bedeli. Bunlar tek başına kullanıcı kazandırmaz ama eksik olunca kaybettirir:

- Tek cümlelik istekten sürükle-bırak ile düzenlenebilen çok günlü AI planı.
- Günlere göre renklenen rota haritası ve duraklar arası süre.
- Konaklama, yemek ve aktivite önerileri ile bağlantıları.
- Ücretsiz çevrimdışı erişim.
- Grubun bütün üyeleri için ücretsiz paylaşım.
- Çoklu para birimiyle harcama kaydı.
- Türkçe ve İngilizce arayüz.

Bunların hepsi kopyalanacak. Sadece çevrimdışı modu bedava vermek bile Wanderlog ve Tripomatic'in en çok şikâyet alan noktasını geçiyor. Fark yaratacak olanlar aşağıdaki yedi özellik.

### Sabah rehberi: günde tek bildirim, dört slot, bir B planı

Sabah rehberi, kullanıcının seçtiği saatte gelen tek bir **yerel bildirim**. Sunucu gerektirmediği için çevrimdışı da çalışıyor. Metin önceki akşam internet varken üretilip telefona konuyor; internet yoksa şablon metne düşülüyor. İçeriği şunlar:

- Günün rotası ve ilk çıkış saati.
- Dört slot: "şurada ye", "şurada çay iç", "şurada alışveriş yap", "bu akşam şurada konakla".
- Open-Meteo'dan hava durumu.
- O güne özel kapanış ve takvim uyarıları.
- Bütçeden kalan günlük harcama limiti.
- Tek bir B planı.

Her önerinin altında, somut sinyallere dayanan bir "neden burası" satırı yer alıyor. Bildirim sayısı bilinçli olarak düşük tutuluyor. Bildirim iznini iptal edenlerin %25'i bunu "çok fazla bildirim" yüzünden yapıyor ([Braze](https://www.braze.com/resources/articles/opt-out-of-push-notifications-why-users-do-it.md), satıcı kaynağı). iOS ve Android'de bir uygulamayı kilit ekranından tek dokunuşla susturmak mümkün ([Appbot](https://appbot.co/blog/app-push-notifications-2026-best-practices/)). Bu yüzden doğru desen günde tek brifing; bunun dışında yalnızca zamana bağlı, yüksek değerli uyarılar. Bunlara örnek: sıradaki durağı etkileyen bir kapanış ya da balonu iptal ettirebilecek hava.

Örnek bir sabah ekranı şöyle görünebilir. Mekân adları yer tutucu, fiyat da örnek:

```
Günaydın. 3. gün: Göreme → Avanos → Ürgüp, ~35 km.
Hava 14°C, 15:00'ten sonra %60 yağmur → açık hava durakları öğleden önceye alındı.
09:00  [açık hava müzesi]                         ~90 dk
12:30  Öğle: [esnaf lokantası], 450 m             tahmini 460–760 TL/kişi*
15:00  Çay: [vadiye bakan çay bahçesi]            ~20 dk
16:00  Alışveriş: [çömlek atölyesi]               kapalı alan, yağmura uygun
Akşam: [Ürgüp'teki otel]
Bugünkü limit: 2.400 TL (dün 300 TL aştın → akşam yemeği daha uygun seçildi)
B planı: balon iptal olursa yarın 05:30 yedek sabah ayrıldı.
* Mart 2026 gözlemi, aylık enflasyonla güncellendi.
```

Uygulama içinde tek elle kullanılabilen bir alt panel ve brifingin sesli okunması, yürürken kullanılabilirliği artırır. Bildirim izinleri de KVKK duyurusuna uygun olarak **türüne göre ayrı ayrı** alınmalı ([Alomaliye](https://www.alomaliye.com/2026/01/14/mobil-uygulamalarda-tek-tik-riza-donemi-bitiyor-bildirim-amaclari-ayrilacak/amp/)).

### Plan onarımı: atlanan durak yeniden çözülür, gün baştan yazılmaz

"Kullanıcı yapmazsa alternatif bul" özelliğinin doğru adı **plan onarımı**. Günü baştan üretmek yerine, aynı gün çözücü kalan zaman için yeniden çalıştırılır. Tetikleyiciler şunlar:

- **Açık atlama:** "atla" kaydırması.
- **Gecikme:** şimdiki zaman + sıradaki durağa varış süresi, o durağın en geç başlangıç saatini aşarsa.
- **Kapalı mekân:** "kapalıydı" bildirimi ya da o günün tarihiyle yeniden değerlendirilen çalışma saati (bayram günü gibi).
- **Hava:** açık hava durağı sırasında yağış olasılığının eşiği aşması.
- **Kaçan öğün:** öğün penceresinin geçmesi.
- **Bütçe aşımı.**

Bir pasif tetikleyici de eklenebilir. Öğle penceresinde planlanan lokantanın geofence'ine hiç girilmediyse uygulama "Burada yemedin galiba, yakında açık iki seçenek var" diye sorar.

Algoritma şöyle çalışır. Başlangıç noktası şu anki konum ve saat, bitiş noktası bu geceki otel. Ziyaret edilmiş duraklar kilitlenir. Kalan planlı duraklara bir "istikrar primi" verilir ki plan gereksiz yere dağılmasın. Yeni adaylar, gün için önceden hesaplanmış bir **alternatif havuzundan** gelir: aynı kategori, şu an açık, belli bir yarıçap içinde, yağmurdaysa kapalı alan ve kalan bütçeye uygun. Çözücü birbirinden farklı 2–3 seçenek döndürür, örneğin "Y'yi çıkar" ile "Y yerine Z". En ucuz LLM her seçenek için iki cümlelik Türkçe bir açıklama yazar, kullanıcı tek dokunuşla seçer.

Araştırma bu yaklaşımı destekliyor. Eylül 2026'da yayımlanan bir çalışma, tek aksaklıklı senaryolarda LLM kullanmayan klasik hiyerarşik onarımın, LLM + Z3 ile baştan planlamaya neredeyse yetiştiğini gösterdi. Klasik onarım orijinal planı belirgin biçimde daha fazla korudu; LLM ile yerel düzenleme ise çok daha fazla token harcadı ([arXiv 2609.19654](https://arxiv.org/abs/2609.19654)). TripTide çalışması da LLM'lerin aksaklıklarla başa çıkma becerisinin plan uzadıkça düştüğünü buldu ([arXiv 2510.21329](https://arxiv.org/abs/2510.21329)). Telefonun çekmediği yerlerde (Karadeniz ve Doğu yolları gibi) cihazın kendisi basit bir ekleme/çıkarma sezgiseli çalıştırır. Bu sezgisel, günün önbelleğe alınmış süre matrisini kullanır; 60×60'lık matris yaklaşık 3.600 sayı tutar. Açıklama şablondan gelir, bağlantı dönünce sunucu yeniden optimize eder.

Kapadokya bunun en net örneği. Balonlar yılda ortalama **yaklaşık 220 gün** uçabiliyor ([TRT Haber](https://www.trthaber.com/haber/turkiye/kapadokyada-balon-turlari-4-gundur-yapilamiyor-932870.html)). Mayıs 2026'da bile birkaç gün üst üste uçuş iptal edildi ([Evrensel](https://www.evrensel.net/haber/5984713/kapadokyada-balon-turlari-olumsuz-hava-kosullari-nedeniyle-yapilmadi)). Bu yüzden planlayıcı balonu ilk sabaha koymalı ve ikinci sabahı yedek olarak tutmalı. İptal olursa alternatif hazır: balonları yerden izleme noktası ve ardından vadi yürüyüşü.

### Çay bahçesinin OSM'de etiketi yok, kategorileri biz kuracağız

Global taksonomiler Türkiye'yi iyi modellemiyor ve bunu veride görmek mümkün. OSM Türkiye'de **17.057 restoran** ve **13.549 kafe** var. Ama çay bahçesi için ayrı bir etiket yok; "çay bahçesi" isim araması 215 farklı isim döndürüyor, yani çoğu `amenity=cafe` altında saklı ve yalnızca isimden bulunabiliyor ([taginfo Geofabrik](https://taginfo.geofabrik.de/europe:turkey/)). Bu yüzden kategori sistemini biz kuracağız. Her kategori plan içinde bir slota bağlanacak.

| Kategori | Plan slotu | Planlayıcı için kritik bilgi |
|---|---|---|
| Kahvaltı salonu / serpme kahvaltı | Sabah | İstanbul Cihangir'de serpme 450–600 TL/kişi (Nisan 2026) ([istanbul.com](https://istanbul.com/blog/food-drink/best-turkish-breakfast-istanbul)) |
| Esnaf lokantası | Öğle | Tencereler öğleden sonra biter. Bütçe ve yerellik isteyen kişiler için öğle varsayılanı. Tam öğün 400–650 TL (Mart 2026) ([Karekod](https://www.karekod.org/blog/lokanta-fiyatlari-guncel-esnaf-lokantasi-ve-restoran-fiyatlari/)) |
| Kebapçı, ocakbaşı, pideci | Öğle veya akşam | Bölgesel imza yemekleri coğrafi işarete bağlanır |
| Meyhane, balıkçı | Akşam | Alkol filtresi gerekir. Kiloyla satılan balıkta pişmeden önce kilo fiyatı ve ağırlık sorulur |
| Çay bahçesi, çay ocağı, kahvehane | Ara mola | OSM'de etiketi yok; isimden ve elle kürasyonla bulunur |
| Tatlıcı, baklavacı | Ara mola | Gaziantep, Hatay ve Afyon UNESCO gastronomi şehirleri ([Hürriyet](https://www.hurriyet.com.tr/haberleri/gastronomi-sehri)) |
| Tarihi çarşı, arasta, han | Gündüz | Kapalıçarşı pazar günleri ve dini bayramların ilk günü kapalı ([Eleman.net](https://www.eleman.net/is-rehberi/calisma-saatleri/kapalicarsi-calisma-saatleri-h8523)) |
| Semt pazarı | Haftanın gününe bağlı | Kadıköy salı, Fatih çarşamba, Feriköy pazar ([Property Turkey](https://www.propertyturkey.com/tr/blog-turkey/10-best-markets-in-istanbul)) |
| Coğrafi işaretli ürün satıcısı | Alışveriş | Yaklaşık 1.881 tescilli ürün ([Bengütürk](https://www.benguturk.com/yasam/baklavadan-pastirmaya-incirden-kayisiya-turkiyenin-avrupa-birliginde-tescilli-46-279307h)) |
| Şarap evi, bağ yolu | Öğleden sonra | Urla ve Trakya rotaları; perakende alkol satışı 22:00–06:00 arası yasak ([Yeni Birlik](https://www.gazetebirlik.com/yasam/tekel-bayileri-kacta-kacta-kapaniyor-2026-tekel-calisma-saatleri-ve-alkol-satis-saatleri/955343)) |
| Dinlenme tesisi, kervansaray, han | Yol günü | Rota koridoru içinde, varış saatine göre seçilir |

Her mekân kaydının taşıması gereken alanlar:

- `category` ve `meal_slots`
- `price_tier`
- `weekly_pattern`, örneğin pazar günü
- `closed_on` (haftalık kapanış günü ve bayramın ilk günü)
- `typical_visit_min`, örneğin müze için 90 dk, çay için 20 dk
- `indoor`, `alcohol_served`, `veg_friendly`
- `step_free_access` (varsayılan değeri "bilinmiyor")
- `signature_items[]` (coğrafi işaret kimliklerine bağlı)
- `last_verified`

`last_verified` alanı süs değil, çünkü mekân verisi hızla eskiyor. Culinary Backstreets'in önerdiği Karaköy'deki Mutfak Dili kapandı ([Culinary Backstreets](https://culinarybackstreets.com/tag/esnaf%20lokantasi)). Antakya Uzun Çarşı'da depremden önceki 2.500'ü aşkın işletmenin 600'den fazlası yıkıldı; dükkânlar Nisan 2026'dan itibaren aşama aşama teslim ediliyor ([TRT Haber](https://www.trthaber.com/haber/turkiye/antakyanin-tarihi-carsisi-ayaga-kalkiyor-933482.html)).

### Güven skoru yıldız ortalamasını değil yerel sinyalleri tartar

Rakip analizinde "Google yorum hızındaki anormallikleri cezalandır" fikri öne çıkıyor. Ancak veri notları bunun pratikte neredeyse imkânsız olduğunu gösteriyor. Google'ın kuralları yalnızca `place_id`'nin süresiz saklanmasına izin veriyor; içeriğin önceden çekilmesi ve önbelleğe alınması yasak ([Google Places politikaları](https://developers.google.com/maps/documentation/places/web-service/policies)). Bir sorgu en fazla 5 yorum döndürüyor ve yorumlar en pahalı SKU'da ([Google Places veri alanları](https://developers.google.com/maps/documentation/places/web-service/data-fields)). Yani anormallik tespitini ancak **kendi topladığımız veride** çalıştırabiliriz. Güven skoru altı bileşenden kurulmalı.

Birinci bileşen **uzman sinyali**. Michelin, Bib Gourmand ve Gault&Millau'da yer alıp almamak bir olgu olarak saklanır ve kaynağa link verilir. İkinci bileşen **kendi kullanıcılarımızın doğrulanmış ziyareti**. "Buradaydım" GPS ile ya da fiş fotoğrafıyla kanıtlanır. Yıldız yerine Beli tarzı karşılaştırma sorulur: "X mi daha iyiydi, Y mi?" Beli kişisel önerileri yaklaşık 15 mekân sıralandıktan sonra açıyor ([Spoon University](https://spoonuniversity.com/school/brown/beli-the-new-app-personalizing-restaurant-reviews-and-recommendations/)). Az oylu mekânların sıralamayı ele geçirmemesi için Bayes küçültmesi ya da Wilson alt sınırı kullanılır ([Evan Miller](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html)).

Üçüncü bileşen **yerel ile turist puanlarını ayırmak**. Bir çalışmada turistlerin aynı restorana yüksek puan verme olasılığı yerlilere göre **en az %13,4 daha fazla** çıktı ([INFORMS](https://www.informs.org/News-Room/INFORMS-Releases/News-Releases/Tourists-Give-Restaurants-Higher-Ratings-Than-Locals-New-Study-Finds)). Yerliler daha sert puanlıyor ve yemeğe daha çok ağırlık veriyor ([FH Wien](https://fh-wien.ac.at/en/news/stars-for-food-online-restaurant-evaluations-under-investigation)). Turist puanı yerli puanından çok yüksekse, bu bir tuzak şüphesi sinyalidir.

Dördüncü bileşen **mekânsal tuzak riski**. Bilinen sıcak noktalara yakınlık cezalandırılır ve bölgeye özgü dolandırıcılık uyarıları gösterilir:

- Sultanahmet'te "rehber" kılığında halı dükkânına götürme.
- Karaköy'de yere düşürülen boyacı fırçası.
- İstiklal'de gece bar faturası dolandırıcılığı.
- Göreme'de şüpheli derecede ucuz balon teklifleri ([MyTurkeyAdventure](https://myturkeyadventure.com/blog/turkey-tour-scams-2026-real-warnings-from-a-local-operator)).
- Culinary Backstreets'in bilerek atladığı Kumkapı balıkçı şeridi ([Culinary Backstreets](https://culinarybackstreets.com/stories/istanbul)).

Galata'da dört Alman turiste 59.000 TL hesap çıkaran restorana kesilen 139.304 TL ceza, riskin gerçek olduğunu gösteriyor ([NTV](https://www.ntv.com.tr/ntvpara/galeri-galatada-turistlere-59-bin-lira-hesap-cikaran-restorana-kesilen-ceza-belli-oldu,Z0se2VNOhk-McZK0gnBZSg)). Beşinci bileşen **tazelik**: 12 aydan uzun süredir doğrulanmamış mekânların puanı düşer. Altıncı bileşen **fiyat şeffaflığı**: menüde basılı TL fiyat olması artı puandır.

Kendi yorum verimizde aranacak anormallikler şunlar:

- Yalnızca tek yorum yazmış hesapların oranı.
- Zamanda yığılma (kısa sürede gelen yorum patlamaları).
- J şeklinde rating dağılımı.
- Yorumla siparişin uyuşmaması (su ve ayran deseni).
- Uzun, çok kısa 5 yıldız dizileri.

App Store'da bu tür sinyallerle kurulan bir sınıflandırıcı %91 yakalama oranına ulaştı ([Springer EMSE](https://link.springer.com/10.1007/s10664-019-09706-9)). Ama bu tür benchmark başarılarının veri kaynaklı karıştırıcılarla şiştiğini de bilmek gerekiyor ([arXiv 2110.15130](https://arxiv.org/pdf/2110.15130)). Kullanıcıya gösterilen "neden burası" açıklaması yapay zekâ cümlesi değil, kontrol edilebilir sinyaller olmalı. Örnek: "yerli puanı 8,4 / turist puanı 8,1, Bib Gourmand 2026, ana caddeden iki sokak içeride, son doğrulama 3 hafta önce". Katkı yapan editörler için Wikivoyage'ın "Don't tout" kuralı benimsenmeli: anlat ama övme, işletme bağını açıkla, birinci tekil şahısla reklam yapma ([Wikivoyage](https://en.wikivoyage.org/wiki/Wikivoyage:Don%27t_tout)).

### Bütçe motoru bugünkü harcamayı yarının planına bağlar

Bütçe motoru deterministik kod; LLM'e iş düşmüyor. **Planlanan maliyet**, çözücünün seçtiği her mekânın en yeni fiyat gözleminin TÜFE ile güncellenmiş hâli. Bu tahmin bir güven bandıyla ve "tahmini, Mart 2026 gözlemi" gibi bir tarih etiketiyle gösterilir. **Gerçek harcama** her kayıtta orijinal tutar ve para birimiyle saklanır. Kur, ödeme gününden önceki son TCMB bülteninin döviz satış kurudur ve kayıt anında dondurulur. TCMB'nin `today.xml` dosyası anahtar istemeden bedava; 23 Ekim 2026'da USD 49,6540 TL, EUR 55,5997 TL ([TCMB](https://www.tcmb.gov.tr/kurlar/today.xml)).

**Günlük limit** şöyle hesaplanır: (toplam bütçe − bugüne kadar harcanan − kesinleşmiş gelecek harcamalar) ÷ kalan gün. Ayrıca kategori limitleri tutulur: yemek, çay-kahve, giriş ücretleri, alışveriş, ulaşım, yakıt ve konaklama. Limit aşılırsa çözücünün amaç fonksiyonuna bir bütçe cezası eklenir. Böylece ertesi günün önerileri kendiliğinden ucuzlar; örneğin akşam meyhanesi yerine esnaf lokantası seçilir. Rakip bütçe uygulamalarının (TravelSpend, Splitwise, Tricount) hiçbiri harcamayı plana bağlamıyor ([Adam & Linds](https://adamandlinds.com/travelspend-review-budget-tracking-full-time-travel/)). Bizim farkımız bu.

Türkiye'ye özgü maliyet kalemleri ayrıca modellenmeli:

- **Müzekart başabaş hesabı.** 2025'te yaklaşık 6,74 milyon Müzekart satıldı ([Dünya](https://www.dunya.com/sektorler/turizm/turkiye-muzecilikte-avrupanin-onune-gecti-haberi-827901)). Topkapı Harem, Aya İrini ve Sedir Adası gibi kartın geçmediği yerler işaretlenmeli ([İGA](https://www.istairport.com/blog/muzekart-ile-ilgili-merak-ettiginiz-her-sey)).
- **Yabancılar için Museum Pass başabaş hesabı.** İstanbul kartı yaklaşık 4 ve üzeri ziyarette kâra geçiyor ([istanbul.com](https://istanbul.com/blog/museums/istanbul-museum-pass)).
- **Köprü ve otoyol ücretleri.** 1 Temmuz 2026'dan beri Osmangazi ve 1915 Çanakkale **1.170 TL**, Yavuz Sultan Selim 110 TL ([Evrensel](https://www.evrensel.net/haber/5990532/otoyol-ve-kopru-gecis-ucretlerine-zam-gelen-zam-sonrasi-gecis-ucretleri-kac-tl-oldu)). Bayramda KGM yolları ücretsiz ama yap-işlet-devret (YİD) projeleri ücretli; navigasyon ücretli yolu seçebiliyor ([Alomaliye](https://www.alomaliye.com/2026/05/21/kurban-bayraminda-otoyol-kopru-ve-toplu-tasima-hizmetleri-ucretsiz-olacak/)).
- **Yakıt.** 20 Ekim 2026'da İstanbul Avrupa yakasında motorin **96,70 TL**, benzin **79,60 TL** ([Dünya](https://www.dunya.com/enerji/akaryakit-fiyatlarinda-son-durum-benzin-motorin-ve-lpgye-zam-indirim-var-mi-20-ekim-2026-haberi-844503)). Motorin şu an benzinden pahalı, bu yüzden kiralık arabanın yakıt tipi hesaba girmeli.
- **Şehirlerarası ulaşım.** YHT Ankara–İstanbul 990 TL ([Medyascope](https://medyascope.tv/2026/08/17/yht-biletlerine-zam-geldi-ankara-istanbul-bileti-990-lira-oldu/)). İç hat uçak biletinde 3.710 / 6.100 TL'lik iki kademeli tavan var ([İstiklal](https://www.istiklal.com.tr/genel/ucak-bileti-iki-kademeli-tavan-fiyat-2026-1076955h)).

Enflasyon bu motorun ana derdi. Eylül 2026'da yıllık TÜFE **%29,73**, aylık **%1,84** ([Forbes TR](https://www.forbes.com.tr/ekonomi/tuik-eylul-enflasyonunu-acikladi-eylul-2026-tuketici-fiyat-endeksi-tuik)). Yani TL fiyatlar ayda yaklaşık %2 kayıyor. Mart 2026'daki 400–650 TL'lik esnaf öğünü, Ekim'e endekslendiğinde kabaca 460–760 TL'ye çıkıyor. Bu bir model tahmini; "tahmini" etiketiyle gösterilmeli ve kullanıcıdan gerçek fiş istenmeli. Yabancı müze ücretleri ve balon gibi avro bazlı kalemler avro olarak saklanıp o günün kuruyla çevrilmeli.

Fişler cihazda ML Kit OCR ile çevrimdışı okunur ([expo-mlkit-ocr](https://awesome.ecosyste.ms/projects/github.com%2Frbayuokt%2Fexpo-mlkit-ocr)). İnternet gelince metin ucuz bir LLM'e JSON şemasıyla parse ettirilir: işyeri, tarih, toplam, KDV, kalemler. Bütçe motorunun yanına bir de "hesabını kontrol et" yardımcısı eklenmeli. 30 Ocak 2026'dan beri lokanta ve kafelerde servis, kuver ve masa ücreti yasak; menü fiyatı nihai fiyat ([Alomaliye](https://www.alomaliye.com/2026/01/30/restoranlarda-servis-kuver-ve-masa-ucreti-yasaklandi/)). Bu, hiçbir rakibin sunmadığı bir "adil fiyat" katmanının hukuki dayanağı. Yerli ve yabancı kullanıcı için iki ayrı bütçe modeli gerekiyor. Yerli kullanıcı TL düşünüyor ve Yunan adalarıyla kıyaslıyor; Doğu Ege adalarına giden Türk turist sayısı yıllık %163 arttı ([Aydınlık](https://www.aydinlik.com.tr/haber/hayat-pahaliligi-yerli-turisti-yurt-disina-mi-itiyor-dogu-ege-adalarina-giden-turk-turist-sayisi-ne-kadar-artti-yunan-turizm-geliri-silaha-mi-gidiyor-479933)). Yabancı kullanıcı ise avro ve dolar düşünüyor ve avro fiyatlı anıtlarla karşılaşıyor.

### Takvim kuralları ve "TripAdvisor tarzı" topluluk katmanı

Planı en sık bozan şeyler takvim kuralları; bunlar çözücüye sert kısıt olarak girmeli:

- **Haftalık müze kapanışları.** Topkapı salı, Arkeoloji Müzeleri, Dolmabahçe ve Rumeli Hisarı pazartesi kapalı ([GuidedIstanbulTours](https://www.guidedistanbultours.com/en/blog/entrance-fees-of-istanbul-museums)).
- **Camiler.** Turistlere beş vakit namazda ve cuma öğlesinde kapalı.
- **Gece müzeciliği (1 Haziran–1 Ekim).** Efes 00:00'a, Hierapolis, Aspendos, Patara ve Side 23:00'e kadar açık; Nemrut gün doğumu için 04:00'te açılıyor ([DHA](https://www.dha.com.tr/kultur-sanat/20-muze-ve-oren-yeri-gece-ziyaretine-acildi-2883050)).
- **Nemrut.** Kar nedeniyle kabaca Aralık'tan Nisan ortasına kadar kapalı ([Medyascope](https://medyascope.tv/2026/04/21/nemrut-sezonun-ilk-turistlerini-karla-karsiladi/)).
- **Ramazan.** İftardan önceki yaklaşık 90 dakikalık trafik ([MyTurkeyAdventure](https://myturkeyadventure.com/ramadan-in-turkey)).
- **Uzun yollar.** İstanbul–Kapadokya araçla yaklaşık 9 saat, uçakla yaklaşık 1 saat 15 dakika. Bu yüzden 6–7 saati aşan bacaklarda uçak önerilmeli; araçla geçen günler 4 saatin altında tutulmalı ([MyTurkeyAdventure](https://myturkeyadventure.com/turkey-road-trip-planner)).
- **Karadeniz.** Rize Türkiye'nin en çok yağış alan ili ([MGM](https://mgm.gov.tr/FILES/arastirma/yagis-degerlendirme/2020alansal.pdf)). Bu yüzden her açık hava durağına kapalı bir alternatif bağlanmalı.

"TripAdvisor tarzı" topluluk özelliği, serbest yıldız yorumu olarak değil dört ayrı katkı türü olarak kurulmalı:

1. Doğrulanmış ziyaretten sonra karşılaştırma sorusu.
2. Tarihli ve süresi dolan kısa ipuçları: "pazartesi kapalı", "Türkçe menüyü iste". Foursquare City Guide 2024–25'te kapandığı için bu boşluk açık ([Foursquare](https://foursquare.com/city-guide-sunset/)).
3. Fiş ya da menü fotoğrafıyla fiyat gözlemi.
4. "Kapalıydı" raporu.

Grup gezilerinde diyet, hareket kısıtı ve bütçe gibi sert kısıtlar her üyenin veto hakkıyla yönetilmeli; kabul edilebilir seçenekler arasında oylama yapılmalı. "Tek kişi karar verir" stratejisinin hem bireysel hem grup memnuniyetini düşürdüğü gösterildi ([TU Delft](https://pure.tudelft.nl/portal/en/publications/you-do-not-decide-for-me(6cf52d4a-8ea2-48a8-8c55-c776c92ac62b).html)).

## Açık veri iki milyon noktayı bedavaya veriyor, Google opsiyonel kalmalı

POI tabanı üç açık kaynaktan kurulur. **Overture Places** dünyada 64 milyonun üzerinde nokta içeriyor. Lisansı kaynağa göre değişiyor: çoğu CDLA-Permissive-2.0, Foursquare kaynaklılar Apache-2.0. Ağustos 2026 sürümünde eski `categories` alanı kullanımdan kaldırıldı, bu yüzden boru hattı yeni taksonomi alanlarıyla yazılmalı ([Overture](https://docs.overturemaps.org/guides/places); [Overture sürüm notları](https://docs.overturemaps.org/blog/2026/08/19/release-notes/)). **Foursquare OS Places** Apache 2.0 lisanslı ([Foursquare docs](https://docs.foursquare.com/data-products/docs/fsq-places-open-source)). **OSM** tarafında Türkiye'de 8.624 otel ve 874 müze var. Ama ülke genelinde yalnızca **26.386 nesnede `opening_hours`** etiketi bulunuyor ([taginfo Geofabrik](https://taginfo.geofabrik.de/europe:turkey/)). Nottingham Üniversitesi'nin Mayıs 2026'da yayımladığı AnythingPOI Türkiye, OSM ve Overture'u **2.201.304 noktada** birleştirmiş. Bu noktaların %84,7'si yalnızca Overture'da, %13,9'u yalnızca OSM'de, sadece %1,4'ü ikisinde birden var. Veri seti ODbL lisanslı ([Zenodo](https://zenodo.org/records/20013733)). Bu iki şey söylüyor: tekilleştirme işi ağır, ama birisi bunu zaten yapmış ve başlangıç noktası olarak kullanılabilir. Kalite ise ayrı bir konu: Kayseri'de belediye verisiyle yapılan karşılaştırmada OSM'nin genel tamlığı yaklaşık 0,56 çıktı ([DergiPark](https://dergipark.org.tr/tr/download/article-file/6280083)).

**Google Places** Türkiye'de en zengin veriye sahip ama sıfır gelirli bir uygulama için pahalı ve kısıtlı. Puan, çalışma saati ve fiyat seviyesi alanları Enterprise SKU'sunda; ayda 1.000 ücretsiz çağrıdan sonra 1.000 çağrı başına 20 $ ([Google fiyatlandırma](https://developers.google.com/maps/billing-and-pricing/pricing); [veri alanları](https://developers.google.com/maps/documentation/places/web-service/data-fields)). Kullanım koşulları daha da bağlayıcı:

- Yalnızca `place_id` süresiz saklanabiliyor; enlem-boylam en fazla 30 gün tutulabiliyor ([Maps Service Terms](https://cloud.google.com/archive/maps-platform/terms/maps-service-terms-20250501)).
- Places içeriği Google dışı bir haritayla birlikte gösterilemiyor ([Maps Service Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms/index-20240522)).

Yani MapLibre haritasının üstüne Google puanı koyamayız. Google ancak bir ihtiyaç olarak kalmalı: son plandaki birkaç durak için anlık bir "hâlâ açık mı" kontrolü. Bunun için Gemini'nin Google Maps grounding özelliği ayda 5.000 sorguya kadar bedava, sonrasında 1.000 sorgu başına 14 $. Dokümanda "yalnızca İngilizce istem ve yanıt" yazıyor; Türkçe arayüz için bu yeniden kontrol edilmeli ([Gemini Maps grounding](https://ai.google.dev/gemini-api/docs/maps-grounding)). Foursquare Places API ayda 500 ücretsiz çağrıdan sonra 1.000 çağrı başına 15 $ ([Foursquare](https://foursquare.com/products/pricing/)). Yandex Maps API ise yıllık ön ödemeli sözleşmeyle satılıyor ([Yandex](https://yandex.com.tr/maps-api/faq?lang=tr)).

**Yorum verisi** için bedava ve yasal olarak yeniden kullanılabilir bir kaynak yok. Tripadvisor API'si geçiş döneminde. Üçüncü taraf kaynaklara göre eski Content API 31 Ağustos 2026'da kapandı, yerini "Terra" aldı ve AI kullanımı ayrı anlaşma gerektiriyor ([SocialCrawl](https://www.socialcrawl.dev/blog/best-tripadvisor-data-apis-2026)). Yorum kazımanın (scraping) Türkiye'de güvenli bir limanı yok. Risk TCK'dan, KVKK'dan (yorumcu adları kişisel veri), kullanım koşullarından, 5846 sayılı Kanun'daki veritabanı hakkından ve haksız rekabetten geliyor ([Mondaq](https://mondaq.com/turkey/copyright/1304746/web-scraping-and-protection-of-websites)). Michelin ve Gault&Millau'dan yalnızca olgular alınabilir: restoranın adı, aldığı ödül, yılı ve link. Açıklama metni, fotoğraf ve logo kopyalanamaz.

**Resmi veri** var ama çoğu makine tarafından okunamıyor. muze.gov.tr'nin API'si yok. 2027 yabancı tarifesi bir PDF; 1 Nisan 2027'den itibaren Museum Pass Türkiye **185 €**, İstanbul **120 €** ([KTB tarifesi](https://www.alomaliye.com/wp-content/uploads/2026/09/2027-muze-orenyeri-yabanci.pdf)). Bu yüzden müze ücretleri ve kapanış günleri, her yıl elle güncellenen bir tablo olarak tutulacak. KTB belgeli tesislerin açık bir listesi ve coğrafi işaret sicilinin toplu bir API'si bulunamadı. Belediye tarafı daha iyi durumda:

- İBB Açık Veri Lisansı CC BY 4.0 ile uyumlu ([İBB](https://data.ibb.gov.tr/license)).
- İETT, İzmir'in dört işletmecisi, Kocaeli ve FlixBus Türkiye için GTFS verisi var.
- 14 şehir için KentKart'tan topluluk tarafından üretilmiş GTFS akışları var ([Mobility Database](https://storage.googleapis.com/storage/v1/b/mdb-csv/o/sources.csv?alt=media); [kk-gtfs](https://github.com/Egezenn/kk-gtfs)).
- Ankara EGO için GTFS yok.

**Konaklama API'leri** bireysel geliştiriciye fiilen kapalı:

- Booking Demand API, imzalı sözleşmeli "Managed Affiliate" statüsü istiyor ([Booking](https://developers.booking.com/demand/docs/getting-started/prerequisites)). Booking Haziran 2025'te binlerce küçük ortağı çıkardı ([Skift](https://skift.com/2025/05/30/why-booking-com-cut-thousands-of-affiliate-partners-and-what-comes-next/)).
- Hotellook 20 Ekim 2025'te kapandı ([Travelpayouts](https://support.travelpayouts.com/hc/en-us/articles/29534131568530-FAQ-on-the-closure-of-Hotellook)).

Doğru yol, affiliate kimliği taşımayan düz arama linkleri; bu hem para kazanmama ilkesine hem de güven konumlandırmasına uyuyor. Kapadokya mağara otelleri ve Ege köy evleri gibi butik konaklamalar zaten açık veri ve elle kürasyonla daha iyi kapsanır. **Ulaşımda** TCDD, oBilet, THY ve İDO için açık bir API bulunamadı. Köprü ve otoyol ücretleri her yıl Ocak ve Temmuz'da, akaryakıt ise EPDK bülteninden haftalık olarak elle güncellenen tablolarla tutulacak.

**Bağlam verisi** için kaynaklar:

- **Hava:** Open-Meteo, reklamsız ve aboneliksiz uygulamalar için günde 10.000 çağrıya kadar bedava. Bağış kabul etmek serbest, veri CC BY 4.0 ([Open-Meteo](https://open-meteo.com/en/terms)). MGM ise veriyi satıyor ve geliştirici API'si yok ([MGM](https://mgm.gov.tr/site/urunler.aspx?u=tum)).
- **Bayram tarihleri:** Nager.Date.
- **Kur:** TCMB.
- **Harita:** OpenFreeMap sınırsız ve ticari kullanıma da açık. Ama toplu indirme tek seferde 3.000 karo ya da 50 MB ile sınırlı ([OpenFreeMap](https://openfreemap.org/)). Bu yüzden çevrimdışı mod için Protomaps'ten kesilmiş bir Türkiye PMTiles dosyası R2'de barındırılmalı ([Protomaps](https://docs.protomaps.com/basemaps/downloads)).

Notlardaki maliyet tahmini, aylık aktif kullanıcı (MAU) başına ayda 2 plan, 40 rota hesabı, 30 harita oturumu ve 20 mekân detayı varsayımıyla yapıldı. Rakamlar liste fiyatlarına göre ve LLM ile barındırma hariç ([Google fiyatlandırma](https://developers.google.com/maps/billing-and-pricing/pricing); [Gemini Maps grounding](https://ai.google.dev/gemini-api/docs/maps-grounding); [Foursquare](https://foursquare.com/products/pricing/)):

| Senaryo | 100 MAU | 1.000 MAU | 10.000 MAU |
|---|---|---|---|
| A. Açık yığın (OpenFreeMap + kendi OSRM'imiz + açık POI + Open-Meteo) | 0 $ API | 0 $ API | 0 $ API (yalnızca sunucu maliyeti) |
| B. Google hibrit (Enterprise detay + Dynamic Maps + Routes) | ~20 $ | ~670 $ | ~7.960 $'a kadar |
| C. Yalnızca Gemini Maps grounding (~20 sorgu/MAU) | 0 $ | ~210 $ | ~2.730 $ |
| D. Foursquare Pro zenginleştirme | ~23 $ | ~293 $ | ~2.693 $ |

Tablodan çıkan karar açık: A senaryosu varsayılan olmalı. C senaryosu yalnızca son plandaki duraklar için ve sıkı kotayla kullanılmalı; kullanıcı başına ayda yaklaşık 10 sorgu, yaklaşık 500 MAU'ya kadar bedava kalıyor.

## LLM önerir, solver karar verir, telefon çevrimdışı ayakta kalır

### Araştırma neden hibrit mimariyi gösteriyor

2024–2026 literatürü tek yönü gösteriyor. TravelPlanner benchmark'ında GPT-4 yalnızca **%0,6** başarı aldı ([arXiv 2402.01622](https://arxiv.org/abs/2402.01622)). LLM'in isteği kısıt problemine çevirdiği ve bir SAT çözücünün problemi çözdüğü sistem ise **%93,9**'a ulaştı ([arXiv 2404.11891](https://arxiv.org/abs/2404.11891)). TriFlow benzer bir yaklaşımla TravelPlanner'da %91,1, TripTailor'da %97 başarıya çıktı ([arXiv 2512.11271](https://arxiv.org/abs/2512.11271)). En güçlü kanıt Google'ın kendi üretim sistemi. Gemini gün gün aktiviteleri öneriyor. Plan güncel çalışma saatleri ve yol süreleriyle doğrulanıyor. Her gün için dinamik programlama, günler arasında da yerel arama yapılıyor; uygulanamayan aktivitelerin yerine geçecek alternatifler paralel olarak çekiliyor ([Google Research](https://research.google/blog/optimizing-llm-based-trip-planning/)). Bir uyarı var: bu benchmark rakamları 2024 ve 2025 başı modellerine ait. Ekim 2026'nın en iyi modelleri tek başına daha iyi plan yapıyor olabilir. Ama bulunan hiçbir 2026 çalışması, salt LLM'in çözücülü sistemlere yaklaştığını göstermiyor. Bu yüzden çözücü kalmalı.

Önerilen boru hattı altı adımdan oluşuyor:

1. LLM serbest metni yapılandırılmış çıktı olarak tipli bir kısıt nesnesine çevirir: tarihler, başlangıç ve bitiş şehirleri, tempo, ilgi alanları, bütçe, mutlaka görülecek yerler, diyet.
2. PostGIS ve pgvector, bölge başına 50–200 aday mekân getirir.
3. İsteğe bağlı olarak LLM, adaylara bu kişiye göre bir fayda puanı verir.
4. Çözücü uygulanabilir günleri kurar.
5. Deterministik denetçiler saatleri, yol süresini, bütçeyi ve öğün slotlarını yeniden kontrol eder (LLM-Modulo deseni, [arXiv 2405.20625](https://arxiv.org/pdf/2405.20625)).
6. LLM Türkçe anlatımı ve "neden burası" açıklamasını yazar.

LLM'in ürettiği hiçbir saat ya da sıralama doğrulanmadan kullanıcıya gitmez.

### Bir günü OR-Tools'ta modellemek

Her gün, tek araçlı ve **zaman pencereli, ödül toplayan bir TSP** olarak modellenir. Literatürdeki adı "zaman pencereli orienteering problemi". Modelin parçaları:

- **Düğümler:** 0 numaralı düğüm sabahki otel ya da şu anki konum, 1 numaralı düğüm bu geceki otel. Yol gezisi günlerinde bu ikisi farklıdır.
- **İsteğe bağlı duraklar:** `AddDisjunction([poi], penalty)` ile eklenir. Ceza, fayda puanı çarpı bir ağırlıktır; mutlaka görülecek yerlere çok büyük ceza verilir ([OR-Tools cezalar](https://developers.google.com/optimization/routing/penalties)).
- **Öğün slotları:** N lokantadan tam birini seçen bir grup olarak kurulur. Öğle penceresi 12:00–14:30, akşam 19:00–22:00; bu pencereler mekânın çalışma saatleriyle kesiştirilir. Çay ve alışveriş slotları da aynı yapıdadır.
- **Zaman boyutu:** Mekân açılana kadar beklemeye izin veren boşluk (slack) içerir ([OR-Tools VRPTW](https://developers.google.com/optimization/routing/vrptw)).
- **Yorgunluk:** İkinci bir "efor" boyutu olarak eklenir; esnek bir üst sınırı vardır.

Tercihler yalnızca ceza ve fayda puanlarıyla girer, böylece çözücü genel kalır.

Notlar ilk sürüm için VROOM'u öneriyor. VROOM OSRM'le doğrudan konuşuyor, çok hızlı ve JSON API'si basit. Ama belgelenmiş API'sinde "bu restoranlardan tam biri" diye bir grup yapısı yok ([VROOM API](https://github.com/VROOM-Project/vroom/blob/master/docs/API.md)). Bizim ürünümüzün çekirdeği tam olarak bu slotlar: bir öğle yemeği, bir çay, bir alışveriş. Bu yüzden **benim önerim doğrudan OR-Tools ile küçük bir Python servisiyle başlamak.** VROOM, saf sıralama gereken yerlerde hızlı bir yedek olarak kalabilir. Timefold'un Python deposu Ekim 2025'te arşivlendi; TypeScript ağırlıklı bir yığın için uygun değil ([PyPI timefold](https://pypi.org/project/timefold/)).

"Rota çevresinde" seçimi şöyle çalışır. OSRM'den gelen rota geometrisi PostGIS'te bir tampon bölgeyle genişletilir: şehirde birkaç yüz metre, otoyolda birkaç kilometre. Adaylar, rotanın o noktasına tahmini varış saatine göre süzülür; öğle 12:30'da Afyon civarına denk geliyorsa adaylar oradan seçilir. Çok günlü planlar dört adımda kurulur:

1. Önce geceleme şehirleri sabitlenir.
2. Adaylar coğrafi kümelere ayrılarak günlere dağıtılır (ITINERA'daki gibi, [alphaxiv](https://alphaxiv.org/abs/2402.07204)).
3. Her gün ayrı çözülür.
4. Google'daki gibi günler arası takaslarla toplam fayda artırılır.

Çözüm süreleri milisaniyelerle saniyeler arasında, yani her şey senkron bir API çağrısında çalışabilir.

### Yönlendirme, veritabanı ve uygulama katmanı

**Yönlendirme** kendi sunucumuzda çalışmalı. Geofabrik'in Türkiye dosyası **621 MB** ve her gün güncelleniyor ([Geofabrik](https://download.geofabrik.de/europe/turkey.html)). Bu dosya üstünde araba ve yaya profilleriyle kurulan OSRM, `/table` uç noktasıyla sınırsız süre matrisi veriyor. Valhalla, istek bazında maliyet ayarı ("toprak yoldan kaçın") ve "20 dakikada nereye ulaşırım" eş-zaman haritaları istersek alternatif. Hazır servisler bu iş için yetersiz. Openrouteservice'in ücretsiz planı günde yalnızca **500 matris** çağrısı veriyor ([ORS](https://openrouteservice.org/plans/)). Google Route Matrix, ayda 10.000 ücretsiz kullanımdan sonra 1.000'de 5 $ ([Google](https://developers.google.com/maps/billing-and-pricing/pricing)). 40 düğümlü bir gün 1.600 hücrelik bir matris demek; eleman başına faturalanıyorsa (doğrulanmadı) ücretsiz kota birkaç gezide biter.

**Veritabanı** tek bir Postgres: PostGIS, pgvector ve pg_trgm eklentileriyle. Supabase'in ücretsiz katmanında 500 MB veritabanı ve 50.000 MAU var. Ama proje **bir hafta işlem görmezse duraklatılıyor**; bu, kişisel kullanım döneminde iki gezi arasında sorun çıkarır. Pro paket ayda 25 $ ([Supabase](https://supabase.com/pricing)). Şemanın kritik parçaları:

- `places`: kaynak kimlikleri, kategori, durum ve `last_verified` ile.
- Ham OSM `opening_hours` dizgileri ve bunların üstüne bayram ve Ramazan için tarih aralıklı geçersiz kılma satırları.
- Tarihli, kaynaklı ve güven puanlı `price_observations` (fiyat gözlemleri).
- Durum (state) ve kilit alanları taşıyan `trip_stops`.
- Çevrimdışı senkronu güvenle tekrarlanabilir kılan `client_uuid` alanlı `expenses`.
- Her atlamayı, gecikmeyi ve kapanışı kaydeden bir `events` günlüğü.

Çalışma saatleri istemcide opening_hours.js ile çevrimdışı değerlendirilir ([npm](https://npmjs.com/package/opening_hours)). Ancak kütüphanenin Türkiye'deki hareketli bayramları doğru işlediği test edilmeden ona güvenilmemeli.

**Uygulama** Expo (React Native, TypeScript) ile yazılmalı. Uygulama, Workers ve sunucu tarafı aynı dili konuşur; bu da yapay zekâ kod asistanıyla bakımı ucuzlatır. React Native 0.82'den beri yalnızca yeni mimari var ([pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/8279/react-native-2026-stack-choices-vs-flutter)). MapLibre React Native de v11'den itibaren yalnızca yeni mimariyi destekliyor ([MapLibre RN](https://maplibre.org/maplibre-react-native/docs/setup/getting-started)). Android'de MapLibre 11.7.0 ve sonrası `pmtiles://file://` ile yerel PMTiles okuyabiliyor; iOS tarafı daha az belgelenmiş ([MapLibre Android](https://maplibre.org/maplibre-native/android/examples/data/PMTiles/)). Bu yüzden iOS'ta PMTiles desteği ilk hafta denenmeli, gerekirse MBTiles'a geçilmeli.

PWA bu iş için zayıf, çünkü ürünün çekirdeği tam da PWA'nın en zayıf olduğu alanlarda:

- Arka planda geofence.
- Kırsal yollarda çevrimdışı harita.
- Zamanlanmış yerel bildirim.
- Kamerayla fiş okuma.

**"Gezi paketi"** indirildiğinde telefona üç şey gelir:

1. Rota koridoru için yaklaşık 14. yakınlaştırma seviyesine kadar kesilmiş PMTiles harita.
2. Mekânları, alternatif havuzlarını, çalışma saatlerini, günlük süre matrislerini, planı ve kurları içeren bir SQLite dosyası.
3. Önceden üretilmiş sabah brifingleri.

Gezi boyunca yerel SQLite asıl veri kaynağıdır. Harcamalar ve olaylar bir "outbox" tablosuna yazılır ve internet geldiğinde sunucuya gönderilir. PowerSync ancak çok cihazlı canlı grup düzenlemesi gerekirse devreye girmeli ([PowerSync](https://www.powersync.com/pricing)).

Geofence için platform sınırları bağlayıcı ([Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)):

- iOS en fazla **20 bölge**, Android 100 bölge izliyor.
- iOS kapatılmış bir uygulamayı geofence olayında yeniden açıyor, Android açmıyor.
- Expo Go arka plan konumunu desteklemiyor; development build gerekiyor.

Çözüm, sıradaki 5–10 durak ve otel için kayan bir pencere tutmak ve beklenen durak saatlerine ayrıca yerel bildirim zamanlamak. Sürekli GPS izleme pili bitirir; Wikiloc kullanıcıları da bundan şikâyetçi ([Ekşi Sözlük](https://eksisozluk.com/entry/75759752)). Sabah brifingi + tetikleyiciyle onarım modeli bu yüzden daha doğru.

### LLM maliyeti ve kötüye kullanım freni

Varsayılan model ucuz ve hızlı olmalı; orta sınıf model yalnızca ilk iskelette ve zor vakalarda devreye girmeli. Notlardaki resmi liste fiyatları (22–23 Ekim 2026, milyon token başına girdi/çıktı):

| Model | Fiyat | Not |
|---|---|---|
| Claude Haiku 5.5 | 0,10 $ / 0,50 $ | 100.000 token'a kadar istemler için |
| Claude Sonnet 5.5 | 2 $ / 10 $ | |
| Gemini 3.5 Flash-Lite | 0,30 $ / 2,50 $ | |
| Batch API | %50 indirim | Gece çalışan zenginleştirme işleri için |

Kaynaklar: [Claude fiyatlandırma](https://platform.claude.com/docs/en/about-claude/pricing); [Gemini fiyatlandırma](https://ai.google.dev/gemini-api/docs/pricing).

Gemini'nin **ücretsiz katmanındaki veriler "ürünlerimizi geliştirmek için" kullanılıyor**. Bu yüzden ücretsiz katman gerçek kullanıcı verisiyle kullanılmamalı; KVKK açısından sorunlu. Gemini'de iki zam da duyuruldu: Argon 1 Aralık 2026'da, 3.8 Flash 1 Ocak 2027'de iki katına çıkıyor ([Gemini fiyatlandırma](https://ai.google.dev/gemini-api/docs/pricing)).

Notlardaki hesap şu varsayımlara dayanıyor: önbelleğe alınan 8.000 token'lık sabit sistem istemi, 150 aday mekân ve 5 günlük anlatım. Sonuçlar:

| Kalem | Haiku 5.5 | Gemini 3.5 Flash-Lite | Sonnet 5.5 |
|---|---|---|---|
| 5 günlük gezi üretimi | ~0,007 $ | ~0,04 $ | ~0,15 $ |
| Bir sabah brifingi | ~0,0008 $ | – | ~0,015 $ |
| Bir onarım açıklaması | ~0,0005 $ | – | ~0,009 $ |
| Kullanıcı başına ay (1 gezi + 5 brifing + 5 onarım) | ~0,014 $ | – | ~0,16 $ (Sonnet + Haiku karışık) |

Türkçe metnin token sayısının İngilizceden 1,3–2 kat fazla olabileceği ölçülmedi. Bu yüzden rakamları alt sınır olarak okumak gerek.

Altyapının toplamı aşağıdaki tabloda. Supabase, Cloudflare Workers ve R2 fiyatları resmi sayfalardan alındı ([Supabase](https://supabase.com/pricing); [Cloudflare](https://developers.cloudflare.com/workers/platform/pricing/)). Hetzner fiyatları 2026'daki iki zammın ardından ikincil kaynaklarda CX23 için 5,49 €, CAX11 için 5,99 € olarak raporlanıyor ([heise](https://heise.de/-11333037)). Cloudflare Workers'ın ücretsiz katmanında istek başına CPU süresi 10 ms ile sınırlı; çözücü orada çalışamaz, ayrı bir VPS'te durmalı.

| MAU | Supabase | Cloudflare | VPS | LLM | Toplam/ay |
|---|---|---|---|---|---|
| 100 | 0 $ (duraklama riski) veya 25 $ | 0 $ | ~6–12 € | 1,5–16 $ | **~8–55 $** |
| 1.000 | 25 $ | 5 $ | ~6–15 € | 14–160 $ | **~50–205 $** |
| 10.000 | 25 $ + ek | 5–10 $ | ~15–30 € | 140–1.600 $ | **~200–1.700 $** |

Ücretsiz ve herkese açık bir AI uç noktası, maliyet istismarının hedefi olur. Yalnızca IP bazlı limit yetmez; çok sayıda IP ile kolayca aşılıyor, anahtar zorunluluğu getirmek ise saldırıyı durdurdu ([Troy Hunt](https://www.troyhunt.com/fighting-api-bots-with-cloudflares-invisible-turnstile/)). Gereken önlemler:

1. Her AI çağrısı için oturum zorunlu (anonim giriş + Turnstile).
2. Sunucu tarafında kullanıcı başına kota. Örnek: ayda 3 gezi üretimi, gün başına 1 brifing, günde 20 onarım açıklaması.
3. Günlük LLM harcaması eşiği aşınca şablon metne düşen bir sigorta. Çözücü LLM'siz de çalıştığı için ürün durmaz.
4. Her sağlayıcının konsolunda sert aylık harcama limiti.
5. İsteyen ileri düzey kullanıcılar için "kendi API anahtarını getir" seçeneği.

## Google yorumlarını göstermek artık hukuki risk, KVKK halka açılınca başlıyor

"TripAdvisor tarzı" bir ürün için en kritik hukuki konu yorumlar. **14 Şubat 2025'te Reklam Kurulu**, Google kaynaklı yorumları doğrulamadan "Tesis Yorumları" başlığıyla gösteren bir şirketi haksız ticari uygulamadan cezalandırdı. Google Türkiye, Maps yorumlarının çalışmaya devam ettiğini ve kararın üçüncü taraf ticari siteleri ilgilendirdiğini açıkladı ([Forbes Türkiye](https://www.forbes.com.tr/teknoloji/google-dan-reklam-kurulu-aciklamasi-yorumlar-ozelligine-yasak-getirilmedi)). **1 Ağustos 2026'da yürürlüğe giren** değişiklikle Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği şunları getirdi ([Takvim](https://www.takvim.com.tr/guncel/2026/07/27/aldatici-reklamlarla-mucadelede-yeni-donem)):

- Sahte tüketici yorumu kesin olarak yasak.
- Satın almayı doğrulayamayan platformlardan gelen yorumlar yayınlanamaz.
- Yapay zekâ karakterlerin reklamda kullanıldığı açıkça belirtilmeli.

Haberlere göre yönetmelik ayrıca şunları istiyor: yalnızca satın alanlar yorum yapabilir, olumlu ve olumsuz yorumlar birlikte yayınlanır, yorumlar en az bir yıl yayında kalır ve sıralama nesnel ölçütlere göre yapılır ([Dünya](https://www.dunya.com/ekonomi/ticaret-bakanligi-acikladi-sahte-yorumlara-yaptirim-uygulanacak-haberi-842114)). Bu maddelerin Resmî Gazete metni doğrudan doğrulanmadı. Uygulama da sert: Ağustos 2026'da bir şirkete, bir tüketici yorumunu yayınlamadığı için **2.167.412 TL** ceza kesildi ([Ekonomist](https://www.ekonomist.com.tr/gundem/sahte-isletme-adi-engellenen-yorum-yaniltici-gorsel-ticaret-bakanligindan-yaniltici-reklamlara-milyonluk-ceza-77925)).

Reklamsız ve ticari olmayan bir bilgi uygulamasının "ticari reklam" kapsamına girip girmediği belirsiz; halka açılmadan önce bir Türk avukattan görüş alınmalı. Ama tasarım her durumda bu standarda göre yapılmalı:

- Google ya da Tripadvisor yorum metni veya yıldız ortalaması "tüketici yorumu" olarak gösterilmez.
- Kendi geri bildirimlerimiz ziyaret doğrulamalı olur.
- Olumsuz yorum bastırılmaz.
- Varsayılan sıralama nesnel ölçütlere dayanır.
- Yorumlar en az bir yıl saklanır.
- Karşılık alarak katkı yapan biri olursa açıkça etiketlenir.

**Lisans ve kullanım koşulu tuzakları** üç tane:

1. **Google:** Kuralları yukarıda anlatıldı (`place_id` dışında saklama yok, Google dışı harita yok). Yorum gösterilecekse yazar atfı da zorunlu ([Google Places politikaları](https://developers.google.com/maps/documentation/places/web-service/policies)).
2. **ODbL'nin paylaşım koşulu:** Bir bölgede OSM restoranlarını başka kaynaklardan gelen restoranlarla karıştırmak "türev veritabanı" üretir. Bu veritabanı kamuya açık kullanılıyorsa ODbL ile paylaşılmalı ([OSMF](https://osmfoundation.org/wiki/Community_Guidelines/Collective_Database_Guideline_Guideline)). En basit çözüm, birleşik POI veritabanını ODbL ile indirilebilir şekilde yayınlamak. AnythingPOI da tam bunu yapmış.
3. **Kazıma:** Yapılmamalı.

Affiliate ortaklıktan da uzak durmak gerekiyor. İkincil kaynaklara göre Booking'in ortaklık şartları, önceden yazılı izin olmadan bir "AI sistemi" kullanılmasını kısıtlıyor ([VorpLabs](https://vorplabs.com/agent-tools/booking-demand-api)).

**KVKK kişisel kullanım döneminde fiilen devreye girmiyor**, çünkü işlenen veri geliştiricinin kendi verisi. Başkaları katıldığı anda başlıyor. Gerekenler:

- Bir aydınlatma metni.
- Hesap, gezi ve harcama verisi için sözleşmenin ifası hukuki sebebi.
- Arka plan konumu için ayrı bir açık onay.
- Türüne göre ayrılmış bildirim onayları ([Alomaliye](https://www.alomaliye.com/2026/01/14/mobil-uygulamalarda-tek-tik-riza-donemi-bitiyor-bildirim-amaclari-ayrilacak/amp/)).
- **Veri minimizasyonu:** Ham GPS cihazda kalır. Sunucuya yalnızca onarım anında yuvarlanmış bir konum gider. LLM sağlayıcılarına ad ve e-posta değil, takma bir UUID gönderilir.
- Veri dışa aktarma ve "verimi sil" uç noktaları.

En ağır yük **yurt dışına aktarım**, çünkü Supabase, Cloudflare ve LLM sağlayıcıları yurt dışında. 1 Haziran 2024'te yürürlüğe giren 7499 sayılı Kanun'la standart sözleşme bir güvence hâline geldi. Bu sözleşmelerin imzadan itibaren **5 iş günü içinde Kurum'a bildirilmesi** gerekiyor ([KVKK](https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu)). Uygulayıcılara göre rutin aktarımlarda açık rıza artık sürdürülebilir bir dayanak değil ([hukukcularevi](https://hukukcularevi.com/veri-merkezi-bulut-hizmet-sozlesmeleri-veri-lokalizasyonu/)). Büyük ABD sağlayıcılarının standart şartları varsayılan olarak Türk standart sözleşme metnini kullanmıyor; bu konu avukatla netleştirilmeli. VERBİS kaydı için Kurul'un 2025/1572 sayılı kararı, 10'dan az çalışanı ve 10 milyon TL'nin altında bilançosu olanları muaf tutuyor. Ancak eski kararlarda eşikler farklı ve muafiyet aydınlatma, güvenlik ve ihlal bildirimi yükümlülüklerini kaldırmıyor ([ekonomim](https://www.ekonomim.com/sehirler/kvkkdan-kucuk-isletmelere-verbis-muafiyeti-haberi-846491)). Gerçek kişi olarak veri sorumlusu olmanın durumu da belirsiz.

## Reklamsız kalmanın formülü: düşük maliyet, açık defter, birden fazla bakımcı

Ücretsiz açık ürünler üç modelle ayakta kalıyor:

- **Çok sayıda küçük bağış.** Wikimedia, Haziran 2024'te biten mali yılda yaklaşık 185,4 milyon $ gelir elde etti; bunun 174,5 milyon $'ı bağış ([ProPublica](https://projects.propublica.org/nonprofits/organizations/200049703)).
- **Üyelik artı kurumsal destek.** OSMF'nin 2023 gelirinde kurumsal üyelikler 201.074 £ tuttu; yaklaşık 3.089 küçük bağıştan 113.000 £'un üzerinde gelir geldi ([OSMF](https://osmfoundation.org/wiki/Finances)).
- **Kurucu parası artı bağış.** Organic Maps bu modeli izliyor ve Türk lirasıyla banka havalesi dahil birçok kanaldan bağış alıyor ([Organic Maps](https://organicmaps.app/donate/)).

Organic Maps aynı zamanda en önemli uyarıyı da veriyor. 2025'teki açık mektup kâr amacı gütmeyen bir yapı ve mali şeffaflık talep etti; bağışların kişisel harcamalarda kullanıldığını iddia etti. Bu iddia tek taraflı ve doğrulanmadı. Sonunda topluluk projeyi CoMaps adıyla çatalladı ([CoMaps açık mektup](https://comaps.preview.codeberg.page/website@714/news/2025-04-16/1/)). CoMaps şimdi Open Collective üzerinde, herkese açık bir defterle yürüyor ([CoMaps](https://www.comaps.app/news/2026-01-09/comaps-in-2026-planning-for-the-future/)). Ürünün satış noktası güven olduğu için yönetişim, para gelmeden önce kurulmalı:

- Açık bir defter (Open Collective ya da bir dernek).
- Aylık maliyetlerin yayınlanması.
- Yazılı bir "ücretli yerleşim yok" kuralı.
- Birden fazla bakımcı.

Ticari olmamak burada teknik bir avantaja dönüşüyor. Open-Meteo, reklam ya da abonelik içermeyen uygulamaları ticari saymıyor ve bağışa açıkça izin veriyor ([Open-Meteo](https://open-meteo.com/en/terms)). Vercel Hobby de bağış istemeyi ticari kullanım saymıyor ([Vercel](https://vercel.com/docs/limits/fair-use-guidelines)). Tersinden bakınca: uygulamaya tek bir reklam konduğu anda bu ücretsiz katmanların bazıları kaybedilir ve maliyet tablosu değişir. Gelir tarafında makul bir karışım şöyle:

- Wikimedia tarzı, aylık maliyeti şeffafça gösteren düzenli mikro bağışlar.
- "Kendi API anahtarını getir" seçeneği.
- Kullanıcıların düzelttiği mekân verisinin, lisans izin verdiği ölçüde OSM'ye geri akması.
- Hibeler.

Hibe tarafında zamana duyarlı bir fırsat var. NLnet/NGI çağrıları 3 Eylül 2026'da açıldı; **son başvuru 3 Kasım 2026**. Yazılımın açık lisansla yayınlanması şart. AB ve Horizon Europe ortağı ülkelere öncelik veriliyor; Türkiye'nin uygunluğu doğrulanmadı ([NLnet](https://www.nlnet.nl/propose); [NLnet uygunluk](https://nlnet.nl/core/eligibility/)). TÜBİTAK 1001 projeye 36 ay boyunca 3 milyon TL'ye kadar destek veriyor ama bir akademik ortak gerektiriyor ([TÜBİTAK 1001 genelgesi](https://www.esenyurt.edu.tr/uploads/2026/08/cxqmu3wcrjl2r-tubitak-1001.pdf)). Türkçe sahte yorum tespiti gibi bir araştırma ayağı bu programa uyar. Hibeler bakımı değil özelliği fonlar; bu yüzden tek büyük kaynağa bağımlı kalmak yerine küçük ve kapsamı net hibeler hedeflenmeli. Lisans önerisi:

- Uygulama ve sunucu için **AGPL-3.0**. Kapalı kopyaları engeller: değiştirip halka açık servis olarak çalıştıran herkes değişikliklerini paylaşmak zorunda kalır.
- Kürate edilmiş Türkiye mekân veri seti için **ODbL**.
- Dokümantasyon için CC BY.

## İlk sürüm: tek kullanıcı, tek bölge, tek gerçek gezi

Yol haritasının mantığı basit: farkı yaratan çekirdek (gün çözücü + plan onarımı + bütçe) ilk günden yapılır, ölçek ve cila sonra gelir. Pilot bölge, senin bir sonraki gerçek gezinin bölgesi olmalı.

| Faz | Hedef | İnşa edilecekler | Bilerek ertelenenler | Bir sonraki faza geçiş kriteri |
|---|---|---|---|---|
| 0. Zemin | Tek bölgede veri ve rota hazır | Pilot bölge için Overture, FSQ ve OSM (ya da AnythingPOI) verisini PostGIS'e almak. OSRM'i Türkiye dosyasıyla Docker'da ayağa kaldırmak. Elle tutulan tablolar: müze ücretleri ve kapanış günleri, Müzekart, köprü-otoyol ücretleri, akaryakıt, Michelin ve Gault&Millau, bölgenin coğrafi işaretleri. Bölge için elle seçilmiş çay bahçesi ve esnaf lokantası listesi. OSRM RAM kullanımını, PMTiles boyutunu ve iOS PMTiles desteğini ölçmek | Uygulama arayüzü, giriş sistemi, LLM | Komut satırından bir gün için "kahvaltı → müze → öğle → çay → alışveriş → otel" planı uygulanabilir çıkıyor |
| 1. Kişisel MVP | Bir gerçek geziyi baştan sona bu uygulamayla yapmak | LLM ile isteği parse etmek, OR-Tools ile slot temelli gün çözücü, harita ve liste ekranı. Önceki akşam üretilen yerel bildirimle sabah rehberi. "Atla / geç kaldım / kapalıydı" butonları ve 2–3 seçenekli onarım. TL bazlı harcama defteri ve günlük limit. Çevrimdışı gezi paketi (SQLite + PMTiles). `events` günlüğü | Grup gezileri, İngilizce arayüz, yorum sistemi, fiş OCR, KVKK süreçleri | Gezi bitti ve günlükteki her başarısızlık bir test vakasına dönüştü |
| 2. Kapalı beta (10–50 kişi: aile, arkadaşlar) | Başka insanların gezisinde de çalışmak | Ek bölgeler. Geofence ile otomatik tetikleyici. Cihazda çevrimdışı onarım sezgiseli. Fiş OCR. Müzekart ve Museum Pass başabaş hesabı. Takvim kuralları (bayram, Ramazan, pazar günleri, gece müzeciliği). Kendi geri bildirimlerimize dayanan güven skorunun ilk sürümü. Grup gezisi ve masraf bölüşme. Anonim giriş, Turnstile ve kotalar. Aydınlatma metni ve ayrı onaylar | Herkese açık mağaza sürümü, hibe başvuruları (NLnet hariç) | Planlanan durakların çoğu sorunsuz tamamlanıyor, kapalı mekân raporları azalıyor, harcama tahmini ile gerçek harcama yakınsıyor |
| 3. Herkese açık | 81 ilde temel kapsam, güvenilir yönetişim | 81 il temel verisi. Yerel editör programı (Wikivoyage kuralları). İngilizce arayüz ve yabancı modu (avro müze fiyatları, Museum Pass hesabı, dolandırıcılık uyarıları, ifade kartları). Birleşik veritabanının ODbL ile yayınlanması. Open Collective. KVKK yurt dışı aktarım sözleşmeleri ve avukat incelemesi. Harcama sigortası ve sert limitler. Erişilebilirlik alanları. Mağaza yayını | Yeni ulaşım ortaklıkları | Aylık maliyet bağışlarla karşılanıyor, birden fazla bakımcı var |

En önce yapılacak iş **gün çözücü**. Gerisinin hepsi ona asılı: sabah rehberi onun çıktısını okuyor, plan onarımı onu yeniden çalıştırıyor, bütçe motoru onun amaç fonksiyonuna ceza ekliyor. Yapay zekâ kod asistanıyla çalışırken çözücü, JSON girdi alıp JSON çıktı veren saf bir fonksiyon olarak yazılmalı. Yanına bir "altın test" seti kurulmalı. Örnekler:

- Salı günü Topkapı asla planlanmaz.
- Cuma 11:30–14:00 arasında cami ziyareti olmaz.
- Saat 22:00'den sonra "şarap al" adımı olmaz.
- Bayramın ilk günü Kapalıçarşı planlanmaz.
- Öğle slotu hiçbir zaman boş kalmaz.

Asistanın yazdığı her değişiklik bu testlerden geçmeli. Yorum sistemi, sosyal özellikler ve 81 il kapsamı bilerek sona bırakılıyor. Bunlar rakiplerin zaten yaptığı ya da yapabildiği şeyler; fark onlardan gelmiyor.

## Güvenmeden önce yeniden doğrulanacak rakamlar

Notlar arasında çelişen ya da tek kaynağa dayanan rakamlar var. Bunlar karar verilmeden ve uygulamaya veri olarak girilmeden önce kontrol edilmeli.

| Konu | Çelişki veya belirsizlik | Nereden kontrol edilmeli |
|---|---|---|
| Müzekart fiyatı | Haber kaynakları 2025 için **200 TL** diyor ([Habertürk](https://www.haberturk.com/muzekart-ile-200-tlye-350den-fazla-muze-ziyareti-3856858)). Başka bir not **60 TL** diyor; bu rakam 2023'teki resmi açıklamaya ([TGRT](https://www.tgrthaber.com/ekonomi/muzekart-ucreti-aciklandi-bakan-ersoy-talimat-verdi-fiyati-sabit-kaldi-2897090)) ve 2026 tarihli ticari bir bloga ([Karekod](https://www.karekod.org/blog/muze-kart-fiyatlari/)) dayanıyor. Daha yeni kaynak 200 TL diyor ama 2026 fiyatı doğrulanmadı | e-Devlet ve Türkiye'nin Müzeleri uygulaması |
| Michelin Türkiye 2026 | Yıldızlı restoran sayısı tutarlı: 2 iki yıldızlı + 15 tek yıldızlı = 17. Toplam seçki 115 mi yaklaşık 170 mi, belli değil. Yeni restoran sayısı 54 mü 38 mi, belli değil. Bir not "2026'dan itibaren ülke çapında seçki" iddiasını aktarıyor, diğeri bunu Michelin'in kendi makalesinde bulamamış ([Michelin](https://guide.michelin.com/gb/en/article/michelin-guide-ceremony/the-michelin-guide-turkiye-reveals-its-2026-restaurant-selection); [HDN](https://www.hurriyetdailynews.com/amp/turkiyes-culinary-revolution-night-that-redefined-michelin-map-216506)) | guide.michelin.com listesi |
| 2027 Ramazan Bayramı | Dünya ve CNN Türk **9–11 Mart** diyor (arife 8 Mart) ([Dünya](https://www.dunya.com/gundem/2027-bayram-tarihleri-ramazan-bayrami-ve-kurban-bayrami-ne-zaman-kutlanacak-haberi-840413)). Nager.Date API'si **10–12 Mart** diyor ve tarihi "geçici" olarak işaretliyor ([Nager.Date](https://date.nager.at/api/v3/PublicHolidays/2027/TR)). Uygulama Nager.Date'e körü körüne güvenirse bir gün kayar | Diyanet takvimi; elle girilen geçersiz kılma satırı |
| Museum Pass 2027 bölge eşleştirmesi | Bir not PDF'ten Ege 105 €, Akdeniz 100 €, Kapadokya 75 € diye bir tablo çıkarmış. Diğeri fiyatların hangi karta ait olduğunun PDF'ten güvenilir şekilde okunamadığını söylüyor | KTB tarifesinin PDF'i (elle) |
| Topkapı yabancı ücreti | 45 €, 55 € (2.750 TL), 60–70 € ya da 64,63 $; Harem dahil mi, o da tartışmalı | muze.gov.tr |
| Kapalıçarşı açılış saati | 08:30 mu 10:00 mı, kaynaklar çelişiyor | Yerinde ya da resmi kaynaktan |
| Coğrafi işaret sayısı | 1.842 (2026'nın ilk çeyreği) ve 1.881 (yıl ortası) farklı dönemlere ait olabilir. Gaziantep için 37 ve 107 rakamları ise tarihsiz ve çelişiyor | TÜRKPATENT sicili |
| Gece müzesi sayısı | 20 mi 27 mi, kaynaklar çelişiyor | KTB duyurusu |
| LLM fiyatları | Claude ve Gemini fiyatları 22–23 Ekim 2026'da resmi sayfalardan alındı. Gemini zamları 1 Aralık 2026 ve 1 Ocak 2027'de geliyor. OpenAI fiyatları yalnızca ikincil kaynaklarda. Türkçe token oranı ölçülmedi | Her bütçe kararından önce sağlayıcı sayfaları |
| Google Route Matrix faturalama birimi | Eleman başına mı faturalandığı doğrulanmadı | Google fatura dokümanı |
| GraphHopper açık kaynak matris | Bir kaynak "var", bir kaynak "yok" diyor | GraphHopper dokümanı |
| Foursquare ücretsiz kota | Resmi sayfa 500 çağrı ve 10.000 çağrılık sandbox gösteriyor; toplayıcı siteler 10.000 diyor | foursquare.com/pricing |
| Gemini Maps grounding dili | Dokümanda "yalnızca İngilizce" yazıyor | Gemini dokümanı (Türkçe testi) |
| Hetzner fiyatları | 2026'da iki zam yapıldı; rakamlar ikincil kaynaktan | hetzner.com |
| VERBİS eşiği | 10 çalışan / 10 milyon TL (2025) ile eski 50 çalışan / 100 milyon TL çelişiyor | Avukat; Kurul kararı metni |
| Turizm polisi hattı | 155 mi, 444 0 887 mi, belli değil | Resmi kaynak |
| İç hat uçak tavan fiyatının üst kademesi | 6.100 TL mi, 6.990 TL'ye mi çıktı, belli değil | SHGM |
| Ask Maps ve Yandex Trip AI Agent | Türkiye'de kullanılabilirlikleri doğrulanmadı; Yandex iddiası tek bir LinkedIn paylaşımına dayanıyor | Düzenli izleme |
| Turist dolandırıcılığı kanun teklifi; yorumlarla ilgili 28/B maddesi | Teklifin yasalaşıp yasalaşmadığı ve maddenin Resmî Gazete'deki metni doğrulanmadı | TBMM ve Resmî Gazete |

## Sonuç

Bu araştırmanın en önemli sonucu şu: Türkiye için "en iyi gezi uygulaması" aslında bir yapay zekâ ürünü değil, bir **operasyon verisi ürünü**. Çalışma saatleri, kapanış günleri, bayram takvimi, ayda %2 kayan fiyatlar ve yalnızca isminden bulunabilen çay bahçeleri; asıl fark bu sıkıcı ve tarihli veride. LLM bu sistemde anlatıcı rolünde. Plan onarımı bile, en yeni araştırmaya göre, LLM olmadan klasik bir onarımla neredeyse aynı başarıyı ve daha istikrarlı bir plan veriyor. Ticari olmamak burada sadece bir konumlandırma değil; teknik ve hukuki bir kaldıraç da. Open-Meteo'nun ve benzeri ücretsiz katmanların kapısını açıyor, Booking'in AI kısıtı gibi tuzaklardan uzak tutuyor ve OTA'ların ve Optiviser'ın asla iddia edemeyeceği bir "çıkar çatışması yok" güvencesi veriyor. Bunun bedeli, güvenin yönetişimle kanıtlanması gerekmesi: açık defter, yazılı kurallar ve birden fazla bakımcı. Organic Maps bunu ihmal etmenin sonucunu gösterdi.

İkinci sonuç, kişisel kullanım döneminin bir demo değil, **veri toplama motoru** olduğu. Atlanan her durak, her "kapalıydı" bildirimi ve her fiş, çözücüyü ve güven skorunu besleyen etiketli bir veri noktası. Bu yüzden `events` günlüğü ilk günden kurulmalı. Google, Ask Maps'i bir gün Türkiye'de Türkçe açacak. O gün savunulabilir fark, Google'ın yapısal olarak yapamayacağı şeylerden gelecek: ticari çıkarı olmayan bir sıralama, Türkiye'ye özgü bir kategori sistemi, tarihli fiyat bilgisi ve şeffaf yönetilen yerel kürasyon. Bunlara ulaşmanın en kısa yolu, bir sonraki gerçek gezini bu uygulamayla yapmak.
