// Bölgeye bağlı dolandırıcılık / tuzak / pratik uyarılar. Alanlar merkez + yarıçap (km) olarak tutulur.
// Kaynakların çoğu turizm rehberi ve haber; resmî bir "dolandırıcılık haritası" yok. Metinler kaynağa
// sadık özetlerdir, öneriler (advice) bizimdir. Merkez koordinatları Wikidata (CC0) öğelerinden.
import type { AreaWarning, WarningArea } from "../model";

export const WARNINGS_CHECKED_AT = "2026-10-24";

const MTA_SCAMS = "https://myturkeyadventure.com/blog/turkey-tour-scams-2026-real-warnings-from-a-local-operator";

// ------------------------------------------------------------ alanlar
const SULTANAHMET: WarningArea = { name: "Sultanahmet", center: { lat: 41.0058, lon: 28.9768 }, radiusKm: 0.9 };
const KARAKOY: WarningArea = { name: "Karaköy", center: { lat: 41.0228, lon: 28.975 }, radiusKm: 0.7 };
const ISTIKLAL: WarningArea = { name: "İstiklal Caddesi", center: { lat: 41.0342, lon: 28.9789 }, radiusKm: 0.9 };
const TAKSIM: WarningArea = { name: "Taksim", center: { lat: 41.0369, lon: 28.9858 }, radiusKm: 0.5 };
const KALEICI: WarningArea = { name: "Kaleiçi (Antalya)", center: { lat: 36.881, lon: 30.7037 }, radiusKm: 0.6 };
const KAPALICARSI: WarningArea = { name: "Kapalıçarşı", center: { lat: 41.0106, lon: 28.9679 }, radiusKm: 0.45 };
const MISIR_CARSISI: WarningArea = { name: "Mısır Çarşısı", center: { lat: 41.0164, lon: 28.9706 }, radiusKm: 0.3 };
const KUMKAPI: WarningArea = { name: "Kumkapı", center: { lat: 41.0042, lon: 28.9647 }, radiusKm: 0.5 };
const GALATA: WarningArea = { name: "Galata", center: { lat: 41.0256, lon: 28.9742 }, radiusKm: 0.6 };
const ISTANBUL_MERKEZ: WarningArea = { name: "İstanbul (merkez ilçeler)", center: { lat: 41.0114, lon: 28.9503 }, radiusKm: 20 };
const IST_HAVALIMANI: WarningArea = { name: "İstanbul Havalimanı", center: { lat: 41.2608, lon: 28.7422 }, radiusKm: 3 };
const GOREME: WarningArea = { name: "Göreme–Uçhisar–Ürgüp", center: { lat: 38.6431, lon: 34.8289 }, radiusKm: 8 };

const W = (w: Omit<AreaWarning, "checkedAt">): AreaWarning => ({ ...w, checkedAt: WARNINGS_CHECKED_AT });

export const AREA_WARNINGS: readonly AreaWarning[] = [
  W({
    id: "sultanahmet-hali-rehber",
    kind: "dolandiricilik",
    title: "Halı dükkânına \"rehber\" daveti",
    text: "Sultanahmet Camii çevresinde yardımsever görünen biri çay ikramı için bir \"aile dükkânına\" davet eder; ardından uzun ve baskılı bir halı satışı gelir, aracı komisyon alır.",
    advice: "Daveti kibarca geri çevir; halı alacaksan dükkânı kendin araştırıp seç.",
    tip: "Sultanahmet'te seni çaya ya da \"aile dükkânına\" çağıran gönüllü rehberlere kibarca hayır de.",
    areas: [SULTANAHMET],
    reportedAt: "2026",
    source: MTA_SCAMS,
  }),
  W({
    id: "sultanahmet-tur-bufesi",
    kind: "fiyat",
    title: "Resmî olmayan tur satış noktaları",
    text: "Sultanahmet'teki bazı resmî olmayan büfeler Boğaz akşam yemeği turu ve Efes günübirlik turu gibi turları şişirilmiş fiyatla, gizli içki ücretleriyle satabiliyor.",
    advice: "Acentenin TÜRSAB belge numarasını TÜRSAB'ın sitesinden doğrula; Western Union ya da kişisel hesaba ödeme isteyene güvenme.",
    tip: "Sultanahmet'te büfeden tur alacaksan acentenin TÜRSAB belge numarasını doğrula.",
    areas: [SULTANAHMET],
    reportedAt: "2026",
    source: MTA_SCAMS,
  }),
  W({
    id: "ayakkabi-boyaci-firca",
    kind: "dolandiricilik",
    title: "Düşen ayakkabı fırçası",
    text: "Bir boyacı önüne fırça düşürür; geri verince teşekkür edip \"bedava\" boya yapar, ardından çoğu zaman 1.000 TL ve üstü para ister.",
    advice: "Fırçayı alma ve yürümeye devam et; istemediğin hizmete para ödemek zorunda değilsin.",
    tip: "Önüne düşen ayakkabı fırçasını alma; \"bedava\" boya sonradan para olarak geri dönüyor.",
    areas: [KARAKOY, SULTANAHMET],
    reportedAt: "2026",
    source: MTA_SCAMS,
    extraSources: ["https://esim.holafly.com/travel-tips/istanbul-scams/"],
  }),
  W({
    id: "istiklal-bar-hesabi",
    kind: "dolandiricilik",
    title: "Bar hesabı tuzağı",
    text: "Beyoğlu–İstiklal'de cana yakın bir yabancı, özellikle yalnız erkekleri isimsiz bir bara götürür; masaya hostesler katılır, hesap fahiş çıkar ve ATM'ye kadar eşlik edilebilir.",
    advice: "Tanımadığın birinin bar davetini geri çevir; kalabalık, bilinen ve fiyatı görünen mekânları seç.",
    tip: "Akşam İstiklal'de tanımadığın birinin \"şu bara gidelim\" davetine uyma; bilinen bir hesap tuzağı.",
    areas: [ISTIKLAL, TAKSIM],
    activeMin: [18 * 60, 5 * 60],
    reportedAt: "2026",
    source: MTA_SCAMS,
    extraSources: ["https://esim.holafly.com/travel-tips/istanbul-scams/"],
  }),
  W({
    id: "berber-ek-hizmet",
    kind: "fiyat",
    title: "Berberde ek hizmet faturası",
    text: "\"Saç kesimi 350 TL\" gibi bir tabela fiyatı, istenmeden eklenen hizmetlerle 5.000–10.000 TL'yi aşan bir hesaba dönüşebiliyor.",
    advice: "Oturmadan kalem kalem yazılı fiyat iste, ekstraları reddet, kart makinesindeki tutarı onaylamadan önce kontrol et.",
    tip: "Berbere oturmadan yazılı fiyat iste; ek hizmetleri tek tek reddet.",
    areas: [SULTANAHMET, ISTIKLAL, TAKSIM, KALEICI],
    reportedAt: "2026",
    source: MTA_SCAMS,
  }),
  W({
    id: "carsi-doviz-tabelasi",
    kind: "fiyat",
    title: "Çarşıda döviz tabelası",
    text: "Kapalıçarşı ve Mısır Çarşısı'ndaki bazı döviz noktalarında panodaki kur yalnızca çok yüksek tutarlar (5.000 $ üstü) için geçerli olabiliyor; sayım sırasında para eksiltme vakaları da bildiriliyor.",
    advice: "Büyük bankaların ATM'lerini kullan; bozdurursan kurun hangi tutar için geçerli olduğunu sor ve parayı gişede iki kez say.",
    tip: "Çarşıda döviz bozdurmadan önce panodaki kurun hangi tutar için geçerli olduğunu sor; parayı gişede say.",
    areas: [KAPALICARSI, MISIR_CARSISI],
    reportedAt: "2026",
    source: MTA_SCAMS,
  }),
  W({
    id: "kumkapi-balikci-cigirtkan",
    kind: "fiyat",
    title: "Kumkapı balıkçılarında çığırtkanlar",
    text: "Kumkapı'nın balık restoranı şeridinde, Culinary Backstreets'e göre agresif karşılayıcılar yoldan geçenleri pahalı restoranlara çekmeye çalışıyor.",
    advice: "Menüdeki fiyatı görmeden oturma; kiloyla satılan balıkta pişmeden önce kilo fiyatını ve tartıyı sor.",
    tip: "Kumkapı'da seni içeri çağırana değil menüdeki fiyata bak; balığın kilo fiyatını pişmeden sor.",
    areas: [KUMKAPI],
    source: "https://culinarybackstreets.com/stories/istanbul/doyuran-2",
  }),
  W({
    id: "galata-59bin-hesap",
    kind: "fiyat",
    title: "Taksicinin önerdiği restoranda 59.000 TL hesap",
    text: "Ekim 2025'te Galata'da taksicinin yönlendirdiği bir balık restoranında dört turiste 59.000 TL hesap çıkarıldı; Ticaret Bakanlığı yaklaşık 30 üründe menüden farklı fiyat tespit edip 139.304 TL ceza kesti.",
    advice: "Taksicinin ya da sokakta çağıran birinin önerdiği yere gitme; siparişten önce menü fiyatlarını gör, hesabı kalem kalem kontrol et.",
    tip: "Galata'da taksicinin ya da çığırtkanın önerdiği restorana gitme; hesabı menü fiyatlarıyla karşılaştır.",
    areas: [GALATA],
    reportedAt: "2025-10-29",
    source: "https://www.ntv.com.tr/ntvpara/galeri-galatada-turistlere-59-bin-lira-hesap-cikaran-restorana-kesilen-ceza-belli-oldu,Z0se2VNOhk-McZK0gnBZSg",
    extraSources: ["https://www.cumhuriyet.com.tr/turkiye/mac-izlemeye-gelmislerdi-4-turist-59-bin-lira-hesap-odedi-o-isletmeye-139-bin-lira-ceza-2448060"],
  }),
  W({
    id: "istanbul-taksimetre",
    kind: "fiyat",
    title: "\"Bozuk\" taksimetre",
    text: "Bazı taksiciler taksimetreyi açmayıp yolculuk sonunda şişirilmiş sabit ücret isteyebiliyor ya da ödeme sırasında banknotları değiştirebiliyor.",
    advice: "BiTaksi ya da Uber gibi uygulamaları kullan veya resmî duraktan bin; taksimetreyi açtır, rotayı haritadan izle, küçük banknot taşı.",
    tip: "Taksiye binince taksimetreyi açtır ya da uygulamayla çağır; küçük banknot taşı.",
    areas: [ISTANBUL_MERKEZ, IST_HAVALIMANI],
    reportedAt: "2026",
    source: MTA_SCAMS,
  }),
  W({
    id: "sahte-turist-polisi",
    kind: "dolandiricilik",
    title: "Sahte \"turist polisi\"",
    text: "Sivil giyimli kişiler sahte kimlik gösterip \"sahte para kontrolü\" ya da uydurma ceza bahanesiyle cüzdanı inceleyip para alabiliyor.",
    advice: "Cüzdanını ya da pasaportunu sivil giyimli kimseye verme; en yakın polis merkezine birlikte gitmeyi öner. Acil durumda 112'yi ara.",
    tip: "Sivil giyimli biri \"polis\" deyip cüzdanını isterse verme; polis merkezine birlikte gitmeyi öner.",
    areas: [ISTANBUL_MERKEZ],
    reportedAt: "2026",
    source: MTA_SCAMS,
  }),
  W({
    id: "kapadokya-ucuz-balon",
    kind: "fiyat",
    title: "Şüpheli ucuz balon teklifi",
    text: "Bir yerel tur işletmecisi, ~150 € civarındaki balon tekliflerini fazla rezervasyon, son dakika iptali ve daha az deneyimli pilot riski nedeniyle şüpheli buluyor; aynı kaynak makul fiyatı 250–300 € olarak veriyor.",
    advice: "Acentenin TÜRSAB belge numarasını TÜRSAB'ın sitesinden doğrula; iptal ve iade koşullarını yazılı al.",
    tip: "Çok ucuz balon teklifine dikkat: acentenin TÜRSAB belgesini ve iade koşulunu sor.",
    areas: [GOREME],
    reportedAt: "2026",
    source: MTA_SCAMS,
  }),
  W({
    id: "kapadokya-balon-hava",
    kind: "bilgi",
    title: "Balon uçuşu hava iznine bağlı",
    text: "Kapadokya'da yılda yaklaşık 220 gün balon uçuşu yapılabiliyor; uçuşlar SHGM Nevşehir Koordinatörlüğünün değerlendirmesine bağlı ve rüzgâr, yağış ya da sis yüzünden iptaller günlerce sürebiliyor (Ocak ve Mayıs 2026'da yaşandı).",
    advice: "Balonu ilk sabaha koy, ikinci bir sabahı yedek bırak; iptalde balonları yerden izleyip vadi yürüyüşü yap.",
    tip: "Balon uçuşu sabah hava iznine bağlı; planında yedek bir sabah bırak.",
    areas: [GOREME],
    reportedAt: "2026-05-19",
    source: "https://www.trthaber.com/haber/turkiye/kapadokyada-balon-turlari-4-gundur-yapilamiyor-932870.html",
    extraSources: ["https://www.evrensel.net/haber/5984713/kapadokyada-balon-turlari-olumsuz-hava-kosullari-nedeniyle-yapilmadi"],
  }),
];
