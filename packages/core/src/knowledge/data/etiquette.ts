// Görgü ve pratik kurallar: mekân türüne göre gösterilen kısa, kaynaklı ipuçları.
// categories boşsa kural geneldir (etiquetteFor ile değil, GENERAL_ETIQUETTE ile gelir).
import type { PlaceCategory } from "../../types";
import type { EtiquetteTip } from "../model";

export const ETIQUETTE_CHECKED_AT = "2026-10-24";

/** Fiyat Etiketi Yönetmeliği değişikliğinin kapsadığı yeme-içme işletmeleri (lokanta, restoran, kafe, pastane ve benzeri) */
const YEME_ICME: PlaceCategory[] = [
  "kahvalti", "esnaf_lokantasi", "restoran", "kebapci", "pideci", "meyhane", "balikci",
  "kafe", "cay_bahcesi", "kahvehane", "tatlici",
];

const MOSQUE_GUIDE = "https://istanbul.com/tr/blog/mosques/istanbul-mosque-etiquette-dress-code";
const TICARET = "https://ticaret.gov.tr/haberler/ticaret-bakanligi-tarafindan-fiyat-etiketi-yonetmeliginde-degisiklik-yapildi";

const E = (e: Omit<EtiquetteTip, "checkedAt">): EtiquetteTip => ({ ...e, checkedAt: ETIQUETTE_CHECKED_AT });

export const ETIQUETTE: readonly EtiquetteTip[] = [
  E({
    id: "cami-kiyafet",
    topic: "cami",
    categories: ["cami"],
    title: "Camiye girerken",
    text: "Omuzlar ve dizler kapalı olmalı; kadınlar ibadet alanına girmeden saçlarını örter. Halı kaplı ibadet alanına ayakkabıyla girilmez; bazı camiler örtü verse de yanında bir eşarp bulundurmak iyi olur.",
    tip: "Camiye gireceksen omuz ve dizler kapalı olsun; kadınlar için yanında bir eşarp bulunsun.",
    source: MOSQUE_GUIDE,
  }),
  E({
    id: "cami-namaz-vakti",
    topic: "cami",
    categories: ["cami"],
    title: "Namaz vakitleri",
    text: "Namazdan önce ve namaz sırasında ziyaretçi girişi çoğu zaman durdurulur; cuma öğle namazı en kalabalık ve en hassas zamandır. Vakitler yıl boyunca değiştiği için o günün vaktini kontrol et.",
    tip: "Cami ziyaretini namaz vakitlerinin dışına koy; cuma öğle en zor saat.",
    source: MOSQUE_GUIDE,
    extraSources: ["https://istanbul.com/tr/blog/iconic-structures/hagia-sophia-tickets-tours"],
  }),
  E({
    id: "cami-fotograf",
    topic: "cami",
    categories: ["cami"],
    title: "Camide fotoğraf",
    text: "Ziyaretçi alanlarında fotoğraf genellikle serbest; flaş kullanma, namaz kılan ya da okuyan kişileri çekme.",
    tip: "Camide flaş kullanma, namaz kılanları çekme.",
    source: MOSQUE_GUIDE,
  }),
  E({
    id: "carsi-pazarlik",
    topic: "pazarlik",
    categories: ["carsi", "hediyelik"],
    title: "Pazarlık",
    text: "Halı, lamba, takı, tekstil ve el işlerinde pazarlık alışveriş kültürünün parçası; gıda, paketli tatlı, içecek ve fiyatı basılı ürünler çoğunlukla sabit fiyatlıdır. Birkaç dükkânı karşılaştır, ikram edilen çay seni alışverişe zorlamaz.",
    tip: "Çarşıda halı, takı, lamba gibi el işlerinde pazarlık normal; gıdada ve fiyatı basılı üründe genelde fiyat sabit.",
    source: "https://istanbul.com/tr/blog/shopping/grand-bazaar-what-to-buy-haggling",
  }),
  E({
    id: "hesap-servis-kuver-yasak",
    topic: "hesap",
    categories: YEME_ICME,
    title: "Servis, kuver, masa ücreti yok",
    text: "30 Ocak 2026'da Resmî Gazete'de yayımlanan değişiklikle lokanta, restoran, kafe ve pastanelerde servis, kuver ya da masa ücreti adıyla zorunlu ödeme istenemez; istemeden getirilen kuver ikramının ücreti alınamaz ve menüde yalnızca ürün fiyatları yer alır.",
    tip: "Hesapta servis, kuver ya da masa ücreti görürsen sor: 30 Ocak 2026'dan beri bunlar istenemiyor.",
    validFrom: "2026-01-30",
    source: TICARET,
    extraSources: ["https://www.alomaliye.com/2026/01/30/restoranlarda-servis-kuver-ve-masa-ucreti-yasaklandi/"],
  }),
  E({
    id: "bahsis-gonullu",
    topic: "bahsis",
    categories: YEME_ICME,
    title: "Bahşiş",
    text: "Bahşiş tamamen gönüllüdür ve hesaba zorunlu kalem olarak eklenemez. Geleneksel ölçü %10 diye bilinir; restoran yatırımcıları derneği TURYİD'e göre kartla ödemenin yaygınlaşmasıyla fiilî oran %2–3'e indi (Ocak 2026).",
    tip: "Bahşiş gönüllü; vermek istersen hesaba eklenmiş olmamalı.",
    validFrom: "2026-01-30",
    source: TICARET,
    extraSources: ["https://www.bloomberght.com/1-trilyon-tl-lik-yeme-icme-ekonomisinin-100-milyar-tl-si-bahsis-3765592"],
  }),
  E({
    id: "balik-menu-fiyati",
    topic: "hesap",
    categories: ["balikci", "meyhane"],
    title: "Balıkçıda fiyatı önce sor",
    text: "Ekim 2025'te Galata'da bir balık restoranında yaklaşık 30 üründe menüden farklı fiyat uygulandığı tespit edildi. Siparişten önce menü fiyatını gör; kiloyla satılan balıkta pişmeden önce kilo fiyatını ve tartıyı sor.",
    tip: "Balıkçıda kiloyla satılan balığın fiyatını ve tartısını pişmeden önce sor.",
    source: "https://www.ntv.com.tr/ntvpara/galeri-galatada-turistlere-59-bin-lira-hesap-cikaran-restorana-kesilen-ceza-belli-oldu,Z0se2VNOhk-McZK0gnBZSg",
  }),
  E({
    id: "alkol-perakende-saat",
    topic: "alkol",
    categories: [],
    title: "Alkol satış saati",
    text: "Alkollü içkilerin perakende satışı (market, tekel bayii) 22:00–06:00 arası yasaktır; yasak turizm bölgelerinde de geçerlidir.",
    tip: "Akşam için içki alacaksan marketten ya da tekelden 22:00'den önce al.",
    validFrom: "2013-06-11",
    source: "https://www.lexpera.com.tr/mevzuat/kanunlar/bazi-kanunlar-ile-375-sayili-kanun-hukmunde-kararnamede-degisiklik-yapilmasi-hakkinda-kanun-6487",
    extraSources: [
      "https://bianet.org/haber/22-00-den-sonra-eve-donerken-icki-almaniz-yasak-146861",
      "https://www.gazetebirlik.com/yasam/tekel-bayileri-kacta-kacta-kapaniyor-2026-tekel-calisma-saatleri-ve-alkol-satis-saatleri/955343",
    ],
  }),
  E({
    id: "acil-112",
    topic: "acil",
    categories: [],
    title: "Acil numara: 112",
    text: "Polis (155), jandarma (156), itfaiye (110) ve ambulans dahil acil hatlar 2021'de 112 Acil Çağrı Merkezi altında birleştirildi; acil durumda 112'yi ara.",
    tip: "Acil durumda 112'yi ara; polis, jandarma, itfaiye ve ambulans tek numarada.",
    source: "https://www.milliyet.com.tr/gundem/icisleri-bakanligi-duyurdu-tum-turkiyede-tek-acil-numaraya-gecildi-6616677",
  }),
];
