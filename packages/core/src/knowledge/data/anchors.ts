// İlçe/belde çapaları: coğrafi işaretlerin yakınlık hesabı ve kapsanan illerde daha isabetli il tespiti.
// İl merkezleri için çekirdekteki PROVINCES (../../provinces) kullanılır; burada yalnızca 8 kapsanan ilin
// ilçe ve turistik belde noktaları var.
// Kaynak: Wikidata (CC0), sorgu tarihi 2026-10-24. İlçe çapası = "Türkiye'nin ilçesi" (Q1147395) öğesinin
// konumu (P625); belde/semt çapaları (Göreme, Kaymaklı, Soğanlı, Eminönü…) ayrı öğelerden.
// Not: En-yakın-nokta yaklaşımıdır, il sınırına yakın yerlerde yanılabilir.

export const KNOWLEDGE_GEO_SOURCE = "https://query.wikidata.org/";

/** il → [ilçe/belde, enlem, boylam] — kapsanan iller */
export const DISTRICT_ANCHORS: Readonly<Record<string, ReadonlyArray<readonly [string, number, number]>>> = {
  "Aydın": [
    ["Bozdoğan", 37.6728, 28.3103], ["Buharkent", 37.9739, 28.7514], ["Çine", 37.6228, 28.0678],
    ["Dalama", 37.7909, 28.0668], ["Didim", 37.3931, 27.2936], ["Efeler", 37.85, 27.8433],
    ["Germencik", 37.8719, 27.6014], ["İncirliova", 37.8625, 27.7297], ["Karacasu", 37.7472, 28.5939],
    ["Karpuzlu", 37.5689, 27.8408], ["Koçarlı", 37.7608, 27.7061], ["Köşk", 37.8633, 28.0564],
    ["Kuşadası", 37.8597, 27.2597], ["Kuyucak", 37.9139, 28.46], ["Nazilli", 37.9158, 28.325],
    ["Ortaklar", 37.8878, 27.5022], ["Söke", 37.7586, 27.4131], ["Sultanhisar", 37.8997, 28.1742],
    ["Yenipazar", 37.8333, 28.1844],
  ],
  "Denizli": [
    ["Acıpayam", 37.4353, 29.3614], ["Babadağ", 37.8183, 28.8683], ["Baklan", 37.9769, 29.6086],
    ["Bekilli", 38.2403, 29.4256], ["Beyağaç", 37.2342, 28.8961], ["Bozkurt", 37.7758, 29.6081],
    ["Buldan", 38.045, 28.8306], ["Çal", 38.0831, 29.3972], ["Çameli", 37.0761, 29.3447],
    ["Çardak", 37.825, 29.6686], ["Çivril", 38.3014, 29.7403], ["Güney", 38.1644, 29.0733],
    ["Honaz", 37.754, 29.269], ["Kale", 37.4453, 28.8558], ["Merkezefendi", 37.7795, 29.083],
    ["Pamukkale", 37.9164, 29.1173], ["Sarayköy", 37.9158, 28.88], ["Serinhisar", 37.5914, 29.2725],
    ["Tavas", 37.5728, 29.0711],
  ],
  "İstanbul": [
    ["Adalar", 40.8753, 29.0944], ["Arnavutköy", 41.1833, 28.7333], ["Ataşehir", 40.9833, 29.1278],
    ["Avcılar", 40.9792, 28.7214], ["Bağcılar", 41.0427, 28.8362], ["Bahçelievler", 40.9975, 28.8506],
    ["Bakırköy", 40.9831, 28.8536], ["Başakşehir", 41.0833, 28.8167], ["Bayrampaşa", 41.0481, 28.9003],
    ["Beşiktaş", 41.0753, 29.0275], ["Beykoz", 41.125, 29.1056], ["Beylikdüzü", 41.0032, 28.6407],
    ["Beyoğlu", 41.0319, 28.9761], ["Büyükçekmece", 41.0311, 28.5483], ["Çatalca", 41.15, 28.45],
    ["Eminönü", 41.0172, 28.9711], ["Esenler", 41.0536, 28.8717], ["Esenyurt", 41.047, 28.658],
    ["Fatih", 41.0114, 28.9503], ["Güngören", 41.0211, 28.8781], ["Kadıköy", 40.9869, 29.0367],
    ["Kağıthane", 41.0861, 28.9806], ["Kartal", 40.9064, 29.2111], ["Küçükçekmece", 41.0219, 28.7772],
    ["Maltepe", 40.9247, 29.1308], ["Pendik", 40.9106, 29.2961], ["Sancaktepe", 40.9895, 29.2432],
    ["Sarıyer", 41.1733, 29.0467], ["Silivri", 41.0731, 28.2472], ["Sultanahmet", 41.0081, 28.9756],
    ["Sultanbeyli", 40.9678, 29.2667], ["Sultangazi", 41.1037, 28.8722], ["Şile", 41.1764, 29.6128],
    ["Şişli", 41.0594, 28.9869], ["Tuzla", 40.8818, 29.3469], ["Ümraniye", 41.0208, 29.1204],
    ["Üsküdar", 41.0284, 29.0598], ["Zeytinburnu", 40.9944, 28.9042],
  ],
  "İzmir": [
    ["Aliağa", 38.7954, 26.971], ["Balçova", 38.3922, 27.0464], ["Bayındır", 38.2242, 27.6472],
    ["Bayraklı", 38.4622, 27.1667], ["Bergama", 39.1225, 27.1817], ["Beydağ", 38.0869, 28.2089],
    ["Bornova", 38.4661, 27.2191], ["Buca", 38.3886, 27.1719], ["Çeşme", 38.3167, 26.3],
    ["Çiğli", 38.4967, 27.0639], ["Dikili", 39.0783, 26.9069], ["Foça", 38.6689, 26.7528],
    ["Gaziemir", 38.3258, 27.1372], ["Güzelbahçe", 38.3597, 26.8881], ["Karabağlar", 38.3847, 27.1133],
    ["Karaburun", 38.6359, 26.5097], ["Karşıyaka", 38.4761, 27.1019], ["Kemalpaşa", 38.4272, 27.4186],
    ["Kınık", 39.0856, 27.3822], ["Kiraz", 38.2306, 28.2044], ["Konak", 38.4145, 27.1441],
    ["Menderes", 38.2519, 27.1339], ["Menemen", 38.6161, 27.0632], ["Narlıdere", 38.3944, 27.0097],
    ["Ödemiş", 38.2311, 27.9719], ["Seferihisar", 38.1975, 26.8388], ["Selçuk", 37.95, 27.3667],
    ["Şirince", 37.9414, 27.4331], ["Tire", 38.0867, 27.735], ["Torbalı", 38.1514, 27.3616],
    ["Urla", 38.3325, 26.7689],
  ],
  "Kayseri": [
    ["Akkışla", 39.0, 36.1667], ["Bünyan", 38.8547, 35.8519], ["Develi", 38.3883, 35.4928],
    ["Erkilet", 38.8221, 35.446], ["Felahiye", 39.09, 35.5669], ["Hacılar", 38.6458, 35.4492],
    ["İncesu", 38.6233, 35.1836], ["Kocasinan", 38.7356, 35.4797], ["Melikgazi", 38.7203, 35.5003],
    ["Özvatan", 39.1061, 35.6989], ["Pınarbaşı", 38.7322, 36.3822], ["Sarıoğlan", 39.0878, 35.9744],
    ["Sarız", 38.4792, 36.5006], ["Soğanlı", 38.345, 34.968], ["Talas", 38.7017, 35.5606],
    ["Tomarza", 38.4578, 35.8047], ["Yahyalı", 38.0992, 35.3589], ["Yeşilhisar", 38.3515, 35.0865],
  ],
  "Manisa": [
    ["Ahmetli", 38.5197, 27.9386], ["Akhisar", 38.9219, 27.8351], ["Alaşehir", 38.3453, 28.5172],
    ["Demirci", 39.0453, 28.6556], ["Gölmarmara", 38.7139, 27.9142], ["Gördes", 38.9328, 28.2894],
    ["Kırkağaç", 39.1064, 27.6692], ["Köprübaşı", 38.7486, 28.4031], ["Kula", 38.5464, 28.6467],
    ["Salihli", 38.4869, 28.1383], ["Sarıgöl", 38.2394, 28.6967], ["Saruhanlı", 38.7678, 27.6471],
    ["Selendi", 38.7547, 28.8739], ["Soma", 39.1833, 27.6056], ["Şehzadeler", 38.6166, 27.4386],
    ["Turgutlu", 38.5, 27.7], ["Yunusemre", 38.6206, 27.4081],
  ],
  "Muğla": [
    ["Bodrum", 37.0336, 27.4303], ["Dalaman", 36.77, 28.8], ["Datça", 36.7286, 27.6867],
    ["Fethiye", 36.6508, 29.125], ["Köyceğiz", 36.9578, 28.6883], ["Marmaris", 36.8536, 28.2661],
    ["Menteşe", 37.2179, 28.3646], ["Milas", 37.3114, 27.7811], ["Ortaca", 36.8397, 28.7672],
    ["Seydikemer", 36.648, 29.3617], ["Ula", 37.1022, 28.4178], ["Yatağan", 37.3425, 28.1392],
  ],
  "Nevşehir": [
    ["Acıgöl", 38.55, 34.5167], ["Avanos", 38.7167, 34.85], ["Derinkuyu", 38.3742, 34.7337],
    ["Göreme", 38.6431, 34.8289], ["Gülşehir", 38.7427, 34.6195], ["Hacıbektaş", 38.9436, 34.5606],
    ["Kaymaklı", 38.4657, 34.7504], ["Kozaklı", 39.2167, 34.85], ["Uçhisar", 38.6289, 34.8039],
    ["Ürgüp", 38.6308, 34.9114],
  ],
};
