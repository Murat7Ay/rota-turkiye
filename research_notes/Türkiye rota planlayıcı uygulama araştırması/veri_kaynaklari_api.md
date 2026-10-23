# Data Sources & APIs for a Turkey-specific AI Trip Planner (state as of October 2026)

Scope note: notes written 2026-10-23. Every figure is tagged with its source; anything older than 2026 or from secondary/aggregator sources is flagged. Prices are list prices in USD unless stated. LLM (model inference) costs are out of scope for this file.

## 1. Places / POI data (Google Places API (New), Foursquare, OSM/Overpass, Overture, Mapbox/HERE/TomTom, Yandex)

### Takeaway
Free open datasets (OSM + Overture + Foursquare OS Places) now give roughly 2+ million Turkey POIs at $0 data cost, but with weak opening-hours/ratings coverage. Google Places has the richest Turkish data, but it is expensive at scale: ratings and hours sit in the "Enterprise" SKU at $20/1,000 after 1,000 free calls a month. Its terms also forbid storing anything except place IDs and forbid showing its content on a non-Google map. For a zero-revenue app, build the POI base from open data and use paid APIs only for narrow, on-demand enrichment, if at all.

### Cited Findings
**Google Places API (New): pricing after the March 2025 change (pricing page last updated 2026-10-21)**
- On March 1, 2025, Google replaced the old USD 200 monthly recurring credit with per-SKU free monthly usage caps. It also introduced Essentials/Pro/Enterprise categories and expanded volume discounts up to 5M+ events. — [Google: March 2025 changes](https://developers.google.com/maps/billing-and-pricing/march-2025); [Google billing overview](https://developers.google.com/maps/billing-and-pricing/overview)
- Free caps are counted per SKU across all projects on a billing account and reset on the 1st of each month at midnight Pacific time. — [Google billing overview](https://developers.google.com/maps/billing-and-pricing/overview)
- Current list prices (first paid band, per 1,000 events) / free monthly cap. All from [Google pricing page](https://developers.google.com/maps/billing-and-pricing/pricing):
  - Text Search: Pro $32 / 5,000 free; Enterprise $35 / 1,000 free; Enterprise+Atmosphere $40 / 1,000 free. "IDs Only" Essentials variant is unlimited.
  - Nearby Search: Pro $32 / 5,000; Enterprise $35 / 1,000; Enterprise+Atmosphere $40 / 1,000.
  - Place Details: Essentials $5 / 10,000; Pro $17 / 5,000; Enterprise $20 / 1,000; Enterprise+Atmosphere $25 / 1,000.
  - Place Photos: $7 / 1,000 free. Autocomplete requests: $2.83 / 10,000 free. Autocomplete Session Usage: unlimited.
- Field-to-SKU mapping drives the cost. `displayName` and `businessStatus` are Pro. `rating`, `userRatingCount`, `regularOpeningHours`, `priceLevel`, `websiteUri` and `nationalPhoneNumber` are Enterprise. `reviews`, `editorialSummary`, `servesBreakfast` and `outdoorSeating` are Enterprise + Atmosphere. `location` is Essentials in Place Details but Pro in Text/Nearby Search. — [Google Places data fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- Optional subscription plans exist as an alternative to pay-as-you-go: Starter $100/month for 50,000 combined calls, Essentials $275/month for 100,000, Pro $1,200/month for 250,000. — [Google billing overview](https://developers.google.com/maps/billing-and-pricing/overview)
- Google offers credits through public programs for nonprofit, startup, crisis-response, news-media and academic organizations. — [Google billing overview](https://developers.google.com/maps/billing-and-pricing/overview)
- Caching: "You can therefore store place ID values indefinitely". "You must not pre-fetch, cache, or store Places API content beyond the allowed exceptions." — [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- Latitude/longitude from the Places API may be cached for up to 30 consecutive calendar days and then must be deleted. This rule has been in the Service Specific Terms since at least 2020; the latest version checked was archived 2025-05-01. — [Maps Service Terms (archived 2025-05-01)](https://cloud.google.com/archive/maps-platform/terms/maps-service-terms-20250501)
- Service Specific Terms §5.3: "Customer must not use Google Maps Content from the Places API in conjunction with a non-Google map." Places content may be used without any map, but then Google attribution is required (§5.2). — [Maps Service Terms (index, multiple versions 2018–2025)](https://cloud.google.com/maps-platform/terms/maps-service-terms/index-20240522)
- Attribution: without a Google Map, the Google logo must be shown (16–19 dp high), or the text "Google Maps" if space is limited. The text must not be translated or localized, and third-party attributions must be shown too. — [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies)

**Gemini API "Grounding with Google Maps" (relevant for an LLM planner)**
- Pricing for Gemini 3+: the first 5,000 requests per month are free, then $14 per 1,000 Maps search queries. Gemini 2.5 and older: $25 per 1,000 grounded prompts. — [Gemini Maps grounding docs](https://ai.google.dev/gemini-api/docs/maps-grounding); [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Display rules: Google Maps sources must be shown right after the content they support, linked, with the text "Google Maps" unmodified, and users must be told when the tool is enabled. The docs page states "English prompts and responses only". — [Gemini Maps grounding docs](https://ai.google.dev/gemini-api/docs/maps-grounding)

**Foursquare Places API**
- Pro endpoints (Place Search, Details, Autocomplete, Place Match): $0 for 0–500 calls per month, $15 CPM for 501–100k, $12 CPM for 100k–500k, $9 CPM above. The page also advertises "up to 10,000 free calls on Pro endpoints" in the sandbox. — [Foursquare pricing](https://foursquare.com/products/pricing/)
- Premium endpoints (Tips, Photos, or premium fields on Search/Details): $18.75 CPM for up to 100k, with no free band. "Ask" endpoints: $30 CPM (Pro) and $36 CPM (Premium). — [Foursquare pricing](https://foursquare.com/products/pricing/)
- Conflict: aggregators (Capterra/GetApp/Fitgap) list a 10,000 free-call allowance. The official page shows a 500-call $0 band plus a 10k sandbox. — [Fitgap](https://us.fitgap.com/products/foursquare-places-api) vs [Foursquare pricing](https://foursquare.com/products/pricing/)

**Foursquare OS Places (open dataset)**
- Licensed under Apache 2.0 (© 2024 Foursquare Labs). It has 20+ attributes and 1,000+ categories. — [Foursquare docs: FSQ OS Places](https://docs.foursquare.com/data-products/docs/fsq-places-open-source)
- The launch release (Nov 2024) had 104,511,073 records globally. — [Simon Willison](https://simonwillison.net/2024/Nov/20/foursquare-open-source-places)
- The Hugging Face copy is now gated (users must accept conditions). The latest release seen is dated 2026-01-12. — [Hugging Face FSQ OS Places](https://huggingface.co/datasets/foursquare/fsq-os-places)

**Overture Maps Places**
- The places theme has 64M+ features. The April 2026 source breakdown is: Meta 59.4M, Microsoft 7.26M, Foursquare 6.75M, plus AllThePlaces (CC0) and others. Most are CDLA-Permissive-2.0, but Foursquare-sourced records are Apache-2.0. — [Overture Places guide](https://docs.overturemaps.org/guides/places)
- Since the 2025-09-24 release, licensing is per place, based on its source. Foursquare data is single-sourced and not blended with other sources' attributes. — [Overture release notes 2025-09-24](https://docs.overturemaps.org/blog/2025/09/24/release-notes/)
- The `categories` property was deprecated in the 2026-08-19 release, with removal planned for the September 2026 release. Pipelines must use the newer taxonomy fields. — [Overture release notes 2026-08-19](https://docs.overturemaps.org/blog/2026/08/19/release-notes/)

**OSM coverage in Turkey: measured counts (Geofabrik taginfo, data until 2026-10-22)**
- All counts below are from [taginfo Geofabrik – Turkey](https://taginfo.geofabrik.de/europe:turkey/):
  - `amenity`: restaurant 17,057; cafe 13,549; fast_food 6,933; bar 1,326; marketplace 1,457; fuel 12,113; place_of_worship 48,685; pharmacy 25,340; toilets 3,072; car_rental 614; charging_station 744.
  - `tourism`: hotel 8,624; guest_house 1,134; hostel 495; motel 227; apartment 513; camp_site 2,218; museum 874; attraction 2,128; viewpoint 2,138; picnic_site 944.
  - `shop`: supermarket 14,961; bakery 3,933; pastry 1,424; butcher 1,499; greengrocer 707; jewelry 1,547; gift 670; confectionery 567; craft 387; mall 1,140.
  - `historic`: ruins 4,743; archaeological_site 3,175; tomb 772; castle 446.
  - `cuisine`: turkish 2,911; kebab 906; regional 384; seafood 220; tea 81.
- Attribute depth is thin. Only 26,386 objects in all of Turkey carry `opening_hours`, 38,689 carry `website` and 46,185 carry `phone`; only 791 hotels or other objects carry `stars`. — [taginfo Geofabrik – Turkey](https://taginfo.geofabrik.de/europe:turkey/)
- Çay bahçesi: there is no dedicated tag (the `cafe=*` key is essentially unused in Turkey, with 6 uses). A name search for "çay bahçesi" returns 215 distinct name values, so tea gardens are mostly tagged as `amenity=cafe` and are findable only by name. — [taginfo Geofabrik – Turkey](https://taginfo.geofabrik.de/europe:turkey/)
- AnythingPOI Türkiye v0.1 (Univ. of Nottingham, May 2026) fuses OSM and Overture into 2,201,304 POIs. 84.7% are Overture-only, 13.9% OSM-only and only 1.4% matched in both. The dataset is ODbL. — [Zenodo AnythingPOI Türkiye](https://zenodo.org/records/20013733)
- A Kayseri study (DergiPark, 2026) comparing OSM with municipal open data found overall completeness of about 0.56. Fuel stations were the most complete category and schools the least; restaurants and hotels were not covered. — [DergiPark Kayseri study](https://dergipark.org.tr/tr/download/article-file/6280083)
- **Older (2016):** OSM in Turkey showed a strong east–west density imbalance, correlated with population and literacy. — [ISPRS 2016](https://isprs-archives.copernicus.org/articles/XLII-2-W1/169/2016/)

**Yandex**
- Yandex Maps API is sold on annual prepaid contracts. A free trial is offered only to customers with at least 10M requests a year; other volumes are negotiated. — [Yandex Maps API FAQ (TR)](https://yandex.com.tr/maps-api/faq?lang=tr)
- The MapKit SDK free version has a 25,000 MAU limit. Map search, routing and panorama search are the billable operations. — [Yandex MapKit prices](https://yandex.kz/dev/tariffs/doc/en/mapkit/prices/)
- The Yandex Türkiye startup program lists Maps API packages of up to 2.5M requests a year ("Başlangıç") and up to 10M ("Gelişim"). — [Yandex startups TR](https://yandex.com.tr/project/startups)

### Inferences
- With roughly 17k restaurants, 13.5k cafés and 8.6k hotels, OSM alone undercounts Turkish venues badly; Overture contributes about 6× more POIs than OSM in Turkey according to the AnythingPOI split. The practical open baseline is Overture places (mostly Meta/Microsoft-sourced, CDLA-Permissive) + FSQ OS Places (Apache) + OSM (ODbL), deduplicated. Opening hours and quality signals remain the main weakness of all three.
- Google's §5.3 means Google Places content (ratings, hours) cannot appear on a MapLibre/OpenFreeMap map. Using Google enrichment forces either a Google Dynamic Map ($7/1,000 loads after 10k free) or a map-less detail sheet with Google attribution. That is a strong lock-in for a free app.
- The Gemini Maps-grounding free 5,000 requests/month is attractive for "verify this café still exists" checks. The stated English-only limitation is a real problem for a Turkish-language UX and should be re-checked before relying on it.
- HERE, TomTom and Mapbox POI search were not researched in depth. Given their per-request pricing and no Turkey-specific advantage found, they are unlikely to beat the open-data baseline for a zero-revenue app.

### Gaps
- No country-level count of FSQ OS Places or Overture places for Turkey was found in published material. Next step: filter the parquet files by `country = 'TR'`. AnythingPOI implies Overture has about 1.9M places in Turkey.
- The FSQ OS Places field schema (whether hours, ratings or popularity are present) could not be confirmed this session. It is believed to lack hours and ratings, but this is unverified.
- The Google pricing-page summary mentions upcoming changes to "discounts and credits". No details or dates were found.
- Google Places quality versus Yandex in Turkey: no published 2025–2026 comparison was found. The claim that "Yandex is strong in Turkey" is unverified; no Yandex Places/Geosearch price list was found.
- HERE / TomTom / Mapbox Search Box pricing for 2026 was not verified. One aggregator claims Mapbox gives 500 free Search Box sessions, from a single source.

## 2. Reviews / ratings: what can legally be used?

### Takeaway
No free, legally reusable source of Turkish restaurant reviews or ratings exists. Google returns at most 5 reviews per place, at the most expensive SKU ($25/1,000), and they cannot be cached. Tripadvisor's API is in transition (legacy Content API reportedly sunset on 2026-08-31, successor "Terra"), with strict display and caching rules. Scraping is legally risky. The realistic options are: link out to Google Maps or Tripadvisor; use curated editorial lists such as Michelin and Gault&Millau (by reference and link); and collect your own users' feedback.

### Cited Findings
- Google Places reviews require the Enterprise + Atmosphere SKU. — [Google Places data fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- Place Details returns at most 5 reviews. This is confirmed by developer reports for the New API and by Google's original announcement (2012, legacy API). — [Google Developer forum](https://discuss.google.dev/t/place-api-new/165003); [Google Maps blog 2012 (old)](https://maps-apis.googleblog.com/2012/07/add-flexible-search-and-google-reviews.html)
- When displaying reviews or photos, you must credit the author (avatar, name, profile link) and give access to the source on Google Maps via `googleMapsUri`. You must also include a notice on how reviews are ordered, and Google recommends the notice "Reviews aren't verified by Google…". — [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- Tripadvisor Content API (legacy): the FAQ says the first 5,000 calls per month are free. The old Master Terms allow caching only per the Caching Policy and require displays of Tripadvisor material to be non-indexable by search engines. — [Tripadvisor Content API FAQ](https://tripadvisor-content-api.readme.io/reference/faq); [Tripadvisor API Master Terms (old)](https://tripadvisor-content-api.readme.io/reference/terms-of-use)
- Third-party sources, unconfirmed by Tripadvisor:
  - The legacy Content API was to sunset on 2026-08-31, replaced by the self-serve "Terra" API with 1,000 free calls and then pay-as-you-go.
  - Only `location_id` may be cached indefinitely.
  - Display requires the bubble rating, review date and a Tripadvisor credit, with logos served from Tripadvisor URLs.
  - AI use beyond narrow cases needs a separate agreement.
  - Sources: [SocialCrawl 2026](https://www.socialcrawl.dev/blog/best-tripadvisor-data-apis-2026); [Supergood API report card](https://supergood.ai/api-report-card/tripadvisor); [VorpLabs](https://vorplabs.com/agent-tools/tripadvisor-content-api)
- Turkish law has no specific scraping statute. Risk comes from the Turkish Criminal Code (TCK), KVKK (personal data such as reviewer names), contract/ToS terms, the sui-generis database right under Law 5846, and unfair competition. This summary comes from a low-reliability legal aggregator. — [law.ungovr.org (low reliability)](https://law.ungovr.org/ai/tr); [Mondaq Turkey: web scraping & website protection](https://mondaq.com/turkey/copyright/1304746/web-scraping-and-protection-of-websites)
- A widely shared Turkish-language article titled "Yargıtay … scraping" is actually about Germany's BGH decision VI ZR 10/24 (1 Nov 2024), not a Turkish court. — [MTR Legal](https://www.mtrlegal.com/tr/yargitay-scraping-hukuk-mucadelesinde-kilavuz-karar-belirledi/)

### Inferences
- An AI planner can use ratings to rank candidates only if it pays per lookup (Google Enterprise $20/1,000, Foursquare Premium $18.75/1,000), and it cannot keep those values. A defensible free substitute is an internal "curation score": Michelin/Gault&Millau presence, coğrafi işaret relevance, OSM/Overture confidence, and in-app thumbs-up/down from the app's own users (with KVKK consent).
- Reviews scraped from Google, Tripadvisor or Yemeksepeti would breach those platforms' ToS. Reviewer names and photos would also be personal data under KVKK. Avoid this.

### Gaps
- Tripadvisor's current (post-August 2026) Terra terms, pricing and caching policy were not found on an official page.
- No Turkish court decision specifically on scraping public review sites was found.

## 3. Official Turkish government & municipal open data

### Takeaway
There is useful official data, but little of it is machine-readable. Museum fees and Museum Pass prices come out as PDFs and tables. KTB facility certification data is published as statistics, not as an open per-facility list. Coğrafi işaret has an official registry but no confirmed bulk API. Municipal open-data portals are the best-structured sources: İBB under a CC BY 4.0–compatible licence; İzmir with official GTFS and an open-data portal; Kocaeli under CC BY. The national veri.gov.tr portal was announced in 2019, but its current state is unverified.

### Cited Findings
**Museums (muze.gov.tr, fees)**
- muze.gov.tr provides the museum list, e-ticket ("E-BİLET") links, Museum Pass and MüzeKart info, and night museum announcements. No API or downloadable dataset is offered. — [muze.gov.tr](https://muze.gov.tr/)
- The official 2027 Museum Pass tariff for foreign visitors (PDF dated 2026-09-04, headed as valid from 01.04.2027):
  - Museumpass Türkiye €185 (15 days, 300+ museums and sites).
  - Museumpass İstanbul €120 (5 days).
  - Regional passes listed at €105, €100, €75, €65 and €60. These cover İzmir/Aydın/Muğla/Denizli for 7 days, Antalya/Mersin/Adana/Denizli for 7 days, Nevşehir/Aksaray for 3 days, and Olympos/Patara beaches (10 entries). The exact price-to-pass mapping could not be parsed reliably from the PDF.
  - Source: [alomaliye.com – 2027 müze/örenyeri yabancı tarifesi (PDF)](https://www.alomaliye.com/wp-content/uploads/2026/09/2027-muze-orenyeri-yabanci.pdf)
- Foreigners pay state-museum prices set in EUR and charged in TL at the daily exchange rate. MüzeKart is effectively for residents and requires a Turkish ID. — [istanbul.com (secondary)](https://istanbul.com/tr/blog/istanbul-museum-pass)
- Secondary 2026 data points:
  - Efes: €40 for foreigners, free with MüzeKart. — [Allianz TR](https://www.allianz.com.tr/tr_TR/seninle-guzel/efes-antik-kenti-hakkinda-bilgiler.html)
  - İstanbul Arkeoloji Müzesi: €15 (2026). — [eleman.net](https://www.eleman.net/is-rehberi/maaslar-ve-ucretler/istanbul-arkeoloji-muzesi-giris-ucreti-h11220)
  - Euronews (June 2026) reported Topkapı became the world's most expensive royal palace entry, at about $64.63. — [Euronews TR](https://tr.euronews.com/2026/06/24/topkapi-sarayi-dunyanin-en-pahali-giris-ucreti-olan-kraliyet-sarayi-oldu)
- MüzeKart (resident) price: blogs report 60 TL, but the news items confirming 60 TL date from earlier years. Treat the 2026 price as unverified. — [Habertürk (older)](https://www.haberturk.com/muzekart-ucreti-bu-yil-da-60-lira-3607675); [karekod.org (2026, commercial)](https://www.karekod.org/blog/muze-kart-fiyatlari/)

**KTB accommodation certification**
- Facilities must hold either a turizm işletmesi belgesi or a basit konaklama belgesi. Under the 2019 regulation (Turizm Tesislerinin Niteliklerine İlişkin Yönetmelik), the certification types are turizm yatırımı, turizm işletmesi and basit konaklama. — [Regulation text (alomaliye)](https://alomaliye.com/wp-content/uploads/2019/06/turizm-tesislerinin-29-08-2024.doc)
- KTB publishes periodic "Bakanlık Belgeli Konaklama Tesisi İstatistikleri" with per-il facility and bed counts; October 2025 figures are marked provisional. No open per-facility list (name, address, coordinates) was found. — [alomaliye: Ekim 2025 statistics](https://www.alomaliye.com/2025/11/07/bakanlik-belgeli-konaklama-tesisi-istatistikleri-ekim-2025/); [2021 per-il table (old)](https://www.alomaliye.com/2021/06/07/bakanlik-belgeli-konaklama-tesisi-istatistikleri-07-06-2021/amp/)

**Coğrafi işaret (geographical indications)**
- News reports citing TÜRKPATENT give a total of 1,842 registered geographical indications at the end of Q1 2026; a mid-2026 report says 1,881, an inconsistency between periods. The Karadeniz region leads with 363. Recent registrations include Çorum su böreği, Hatay abugannuş, Kırklareli köftesi and Gaziantep leblebili kıtır helva. — [Uzmanpara/Milliyet Q1 2026](https://uzmanpara.milliyet.com.tr/uzmanpara/turkpatente-basvuru-yagdi-yerli-basvurular-rekor-kirdi-dunyanin-konustugu-urunler-listede-7589321); [Uzmanpara/Milliyet H1 2026](https://uzmanpara.milliyet.com.tr/uzmanpara/patent-basvurulari-yuzde-31-artti-7638558)
- Turkey's EU-registered geographical indications reached 46 with Kayseri Pastırması on 2026-03-26. — [Bengütürk](https://www.benguturk.com/yasam/baklavadan-pastirmaya-incirden-kayisiya-turkiyenin-avrupa-birliginde-tescilli-46-279307h)

**Municipal open data & national portal**
- İBB Açık Veri Lisansı v1.0 is stated to be compatible with CC BY 4.0 and ODC-By. It allows commercial and non-commercial reuse, combination and redistribution with attribution. It does not cover personal data, logos or trademarks, and it forbids implying endorsement. — [data.ibb.gov.tr/license](https://data.ibb.gov.tr/license)
- İETT GTFS is published on İBB's portal. — [İBB: İETT GTFS](https://data.ibb.gov.tr/en/dataset/iett-gtfs-verisi)
- İzmir's open-data portal (acikveri.bizizmir.com) hosts official GTFS for ESHOT, Metro İzmir, İZBAN and Tram İzmir. — [İzmir Açık Veri: toplu ulaşım GTFS](https://acikveri.bizizmir.com/dataset/toplu-ulasim-gtfs-verileri)
- veri.gov.tr was announced in 2019 by the Cumhurbaşkanlığı Dijital Dönüşüm Ofisi as the national open-data portal (**old**). Its current dataset count and licence were not found. — [memurlar.net 2019](https://www.memurlar.net/haber/868335)

### Inferences
- Museum fees are the most valuable official budget data and change yearly; the 2027 tariff takes effect on 1 April 2027. Plan for a manually maintained table: fee in EUR for foreigners, TL/MüzeKart status for citizens, and the season and night-museum flags. Refresh it every time the Ministry publishes a new tariff.
- Coğrafi işaret data is ideal for "taste/buy here" cards (product, il/ilçe, category). In practice it will need a one-off curated extraction from ci.turkpatent.gov.tr registry pages. Factual product names and places are not copyrightable, but check the portal's ToS before any automated collection.
- For "Bakanlık belgeli" trust badges, the realistic route is per-facility verification against KTB's online query pages, not a bulk dataset.

### Gaps
- No machine-readable museum dataset (hours, closing days, fees) was found. The muze.gov.tr per-site pages were not inspected individually.
- ci.turkpatent.gov.tr: no bulk export or API was confirmed, and its terms of use were not reviewed.
- TÜİK tourism statistics, Ankara/Antalya open-data portals and the current status of data.gov.tr / veri.gov.tr were not researched this session.
- The full 2026 museum tariff in EUR (per site) was not obtained from an official source.

## 4. Accommodation (Booking, Expedia, Hotelbeds, Agoda, Airbnb, Turkish OTAs)

### Takeaway
For an individual, non-commercial developer, hotel APIs are effectively closed. Booking.com's Demand API needs a contract as a Managed Affiliate Partner, and Booking dropped thousands of small direct affiliates in June 2025, routing them to Awin or CJ. Expedia Rapid needs a business with traction, and Hotellook (Travelpayouts) shut down in October 2025. Deep links and affiliate widgets are the only realistic route, and they conflict with a "no revenue" stance unless commissions are declined or donated.

### Cited Findings
- Booking.com Demand API prerequisites: you must be a registered Booking.com Managed Affiliate Partner. Partner Centre access is given by an Account Manager after a signed contract, and only then can you create an API key and `X-Affiliate-Id`. — [Booking Demand API prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites)
- Booking.com sent termination notices in May 2025, effective 2025-06-20, to many smaller affiliates and asked them to reapply via Awin, or CJ in some regions. Estimates put the number cut in the thousands. — [Skift](https://skift.com/2025/05/30/why-booking-com-cut-thousands-of-affiliate-partners-and-what-comes-next/); [PhocusWire](https://www.phocuswire.com/booking-terminates-partnerships-content-creators); [NetInfluencer](https://www.netinfluencer.com/booking-com-moves-all-affiliates-to-awin-what-to-know-about-termination-notices)
- One later guide says all new applicants since June 2025 are routed via CJ. This conflicts with the Awin-first framing above. — [MakeInfluence](https://www.makeinfluence.com/en/academy/booking-coms-affiliate-program-how-travel-creators-earn-commission)
- Third-party claims, unverified: new Connectivity onboarding is paused and there is a rate limit of 50 requests/minute. The General Partner Terms (v5) reportedly prohibit using an "AI system" in performing the agreement without Booking's prior written approval, which matters for an AI planner. — [Supergood: Booking](https://supergood.ai/api-report-card/booking-com); [VorpLabs: Booking Demand API](https://vorplabs.com/agent-tools/booking-demand-api)
- Expedia Rapid is partner-only: application, approval and certification, with no self-serve signup. Individual developers find it hard to get and need a corporate entity and track record. The lighter Expedia affiliate program (widgets, deep links) is the realistic option for small sites. — [Supergood: Expedia](https://supergood.ai/api-report-card/expedia-affiliate-network); [dev.to guide for individual developers](https://dev.to/kouta222/complete-guide-for-individual-developers-recommended-hotel-affiliate-apis-by-region-4c1e); [Adivaha](https://www.adivaha.com/expedia-apis.html)
- Hotellook (Travelpayouts) closed on 2025-10-20. Its widgets and API stopped working; some links redirect to Booking.com. — [Travelpayouts FAQ on Hotellook closure](https://support.travelpayouts.com/hc/en-us/articles/29534131568530-FAQ-on-the-closure-of-Hotellook)
- Travelpayouts lists which brands provide APIs or data feeds to partners. Its marketing mentions Booking.com, Agoda and Tripadvisor among 100+ programs (undated). — [Travelpayouts: brands with API/data feeds](https://support.travelpayouts.com/hc/en-us/articles/20384016664594-Brands-that-provide-access-to-APIs-and-data-feeds-for-Travelpayouts-partners); [Travelpayouts blog](https://www.travelpayouts.com/blog/hotelscombined-affiliate-program-alternatives/)
- HotelRunner, a Turkish channel manager, markets an "Anlık Rezervasyon API" for real-time availability for hotels' direct bookings. This is a supplier-side product, not an aggregator for third-party apps. — [HotelRunner mağaza](https://hotelrunner.com/tr/magaza)

### Inferences
- Recommended approach: drop live hotel prices. Use open POI data (OSM `tourism=hotel/guest_house/hostel`, about 10.5k objects, plus Overture/FSQ lodging) for location and type. Estimate budgets from the user's input or from TÜİK/KTB averages. Offer deep links (plain search URLs to Booking/Etstur/Google Hotels), which need no API.
- For boutique stays (Kapadokya cave hotels, Ege köy evleri), OSM/Overture name and category data plus a hand-curated list will outperform any API available to an individual. Many such places are "basit konaklama belgeli" and are absent from the big OTA APIs anyway.
- Airbnb has no public API (no contrary evidence found). Do not scrape it.

### Gaps
- No public information was found on affiliate or API programs for Etstur, Tatilsepeti, Otelz or Jolly Tur. Next step: contact their B2B/partner teams directly.
- Hotelbeds and Agoda direct API access requirements for individuals were not verified in 2026.
- No 2026 status was found for the Booking.com affiliate route via Awin/CJ for Turkish individuals.

## 5. Transport (routing engines, Google Routes, buses, TCDD, flights, ferries, tolls, fuel, traffic)

### Takeaway
Routing is solved cheaply. Self-host OSRM/Valhalla/GraphHopper on an OSM Turkey extract, or use the free OpenRouteService Standard plan (2,000 directions/day) for early stages; Google Routes Essentials costs $5/1,000 after 10k free. Turkish intercity transport data is the hard part. There is no public API for TCDD/YHT, oBilet, İDO/BUDO or Turkish airlines, and fuel prices come only as an EPDK bulletin. Tolls must be maintained as a manual table: KGM raised tariffs 25.49% on 1 Jan 2026, and KÖİ crossings were re-tariffed on 1 July 2026. Some GTFS exists: İstanbul İETT, İzmir (4 operators), Kocaeli, FlixBus Türkiye, and community-generated KentKart feeds for 14 cities.

### Cited Findings
**Routing**
- OpenRouteService Standard (free, for everyone): 2,000 directions/day at 40/minute. The Collaborative plan (humanitarian, academic, government or non-profit) allows 10,000/day at 60/minute, with no commercial use. Self-hosting is unlimited. — [openrouteservice plans](https://openrouteservice.org/plans/)
- GraphHopper free plan: 500 credits/day, 5 locations per request, non-commercial use only, hard-blocked after daily credits are used. — [GraphHopper pricing](https://www.graphhopper.com/pricing/)
- Stadia Maps free tier: development, evaluation and non-commercial use; for-profit organizations are excluded. The official FAQ refers to a monthly credit limit, and a Stadia post cites 200,000 credits/month, while an aggregator claims 2,500/day (conflict). — [Stadia FAQ](https://stadiamaps.com/faqs/); [Stadia blog](https://stadiamaps.com/learn/what-does-a-free-map-api-cost/)
- Google Compute Routes: Essentials $5/1,000 (10,000 free), Pro $10/1,000 (5,000 free). Compute Route Matrix has the same prices. — [Google pricing](https://developers.google.com/maps/billing-and-pricing/pricing)

**Public transport GTFS (Mobility Database catalog, downloaded 2026-10-23)**
- There are 24 Turkish entries. All are from the [Mobility Database catalog CSV](https://storage.googleapis.com/storage/v1/b/mdb-csv/o/sources.csv?alt=media) unless otherwise linked:
  - İstanbul: İETT GTFS on İBB's portal.
  - İzmir: ESHOT, Metro İzmir, İZBAN and Tram İzmir, with licence links to acikveri.bizizmir.com.
  - Kocaeli: `veri.kocaeli.bel.tr`, CC-BY; an older kocaeli.bel.tr feed is marked deprecated.
  - Isparta: private Halk Otobüsleri.
  - **FlixBus Türkiye** (intercity, status "active").
  - Third-party feeds generated from KentKart for Adana, Antalya, Burdur, Çanakkale, Düzce, Erzurum, Gaziantep, Kastamonu, Kırklareli, Kocaeli, Mardin, Muğla, Ordu and Safranbolu. — [Egezenn/kk-gtfs](https://github.com/Egezenn/kk-gtfs)
- The ESHOT feed validates with 0 errors and 9 warnings. Its service period starts July 2024, so check freshness. — [Mobility Database mdb-1823](https://mobilitydatabase.org/feeds/gtfs/mdb-1823)
- No EGO Ankara GTFS appeared in the catalog. — [Mobility Database catalog CSV](https://storage.googleapis.com/storage/v1/b/mdb-csv/o/sources.csv?alt=media)

**Intercity bus, rail, flights, ferries**
- oBilet lists 130+ bus companies. No public affiliate or API documentation was found. — [obilet.com](https://www.obilet.com/otobus-bileti-al)
- No public TCDD Taşımacılık API or open YHT timetable dataset was found. Timetables are published on the TCDD website and changes are announced through news. — [Ekonomist: YHT schedule news](https://www.ekonomist.com.tr/haberler/yht-bolgesel-trenler-marmaray-baskentray-17-mayis-sonrasi-sefer-saatleri-belli-oldu-21970)
- The Aviasales/Travelpayouts Data API serves cached prices from users' searches. It needs only a Travelpayouts token, and data is kept for up to 7 days, so it suits static or "typical price" content. Real-time flight search requires brand approval. — [Travelpayouts: Aviasales Data API](https://support.travelpayouts.com/hc/en-us/articles/203956163); [Requirements](https://support.travelpayouts.com/hc/en-us/articles/203956083-Requirements-for-Aviasales-data-API-access)

**Tolls and fuel**
- KGM toll tariffs rose by 25.49% (the yeniden değerleme rate) from 1 Jan 2026. Example: 15 Temmuz Şehitler and FSM köprüsü went from 47 TL to 59 TL for cars, and Yavuz Sultan Selim from 80 TL to 95 TL. — [Euronews TR, Dec 2025](https://tr.euronews.com/2025/12/23/2026-yilinda-kgmye-ait-kopru-ve-otoyol-ucretlerine-yuzde-2549-zam-yapilacak)
- From 1 July 2026, KÖİ/YİD crossings were re-tariffed: Osmangazi and Çanakkale 1915 bridges cost 1,170 TL, and İstanbul–İzmir otoyol plus bridge totals 2,525 TL. Sources conflict on some routes (e.g., İstanbul–Ankara). — [İşbank blog, 2026-07-23](https://www.isbank.com.tr/blog/2026-kopru-ve-otoyol-ucretleri); [HesapKurdu](https://www.hesapkurdu.com/tasit-kredisi/rehber/hgs-gecis-ucret-ne-kadar)
- EPDK publishes a daily "Bayi Satış Fiyatı Bülteni" on its bildirim portal. It is a web query, not a documented API, and its dealer prices are not necessarily what a station's pump shows. — [Bigpara (citing EPDK bulletin)](https://bigpara.hurriyet.com.tr/akaryakit-fiyatlari/); [hakedis.org](https://www.hakedis.org/endeksler/epdk-akaryakit-bayi-satis-fiyatlari)

### Inferences
- Self-hosting is the right default for routing: OSRM (fast, car profile), Valhalla (multimodal, isochrones) or GraphHopper open source, on Geofabrik's Turkey extract. It removes per-request costs entirely and avoids non-commercial-only clauses (GraphHopper and Stadia free tiers).
- Toll and fuel costs for the budget module: keep a small curated table of KGM/KÖİ tolls by segment, refreshed each January and July. Compute fuel as distance × consumption × the EPDK bulletin price per il, with manual or weekly refresh. Do not depend on scraping.
- Intercity buses, YHT, flights and ferries (İDO, BUDO, Gestaş) should be "deep link + typical duration and price" in v1. FlixBus Türkiye GTFS and İZBAN/Marmaray-type GTFS feeds can supply real schedules where they exist.

### Gaps
- No public API or affiliate info was found for Enuygun, oBilet, THY, Pegasus, AJet, İDO, BUDO or Gestaş. Turkish domestic route coverage in the Aviasales cache was not verified.
- No public source for live traffic data in Turkey (İBB has traffic-index datasets, but they were not verified this session).
- HGS/OGS has no API; the KGM official tariff page was not fetched.
- Rental car APIs were not researched.

## 6. Weather & context (Open-Meteo, MGM, events, prayer times / bayram calendars, museum closing days)

### Takeaway
Open-Meteo is the clear choice: free for non-commercial, ad-free and subscription-free apps up to 10,000 calls/day, CC BY 4.0. MGM sells data and has no developer API. Bayram and public-holiday dates are available free from Nager.Date, including tentative 2027 Ramazan and Kurban Bayramı dates. No official free API exists for Diyanet prayer times or Turkish events (Biletix, Passo, Bubilet).

### Cited Findings
- Open-Meteo's free tier allows fewer than 10,000 calls/day, 5,000/hour, 600/minute and 300,000/month, counted per IP and app. "Non-commercial" includes private or non-profit apps with no subscriptions or ads, and voluntary donations ("tip jar") are allowed. Apps with ads or subscriptions count as commercial. Data is CC BY 4.0. — [Open-Meteo terms](https://open-meteo.com/en/terms)
- MGM sells meteorological data and products through its Döner Sermaye "Meteorolojik Ürünleri Pazarlama Birimi" and the MEVBİS system. No developer API was found. Community NuGet packages scrape MGM pages and are unofficial. — [MGM ürünler](https://mgm.gov.tr/site/urunler.aspx?u=tum); [NuGet community packages](https://www-0.nuget.org/profiles/ZaferAYAN)
- Nager.Date public holidays API for TR, 2027 (queried 2026-10-23):
  - Ramazan Bayramı 10–12 March, marked "Tentative Date".
  - Kurban Bayramı 16–19 May, tentative.
  - Plus all national days: 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos and 29 Ekim.
  - Source: [Nager.Date API TR 2027](https://date.nager.at/api/v3/PublicHolidays/2027/TR)
- Diyanet prayer-time data is used via unofficial wrappers of an "Awqat Salah" REST API. No official developer documentation or terms were found. — [erdemarslan/namazvakti (GitHub)](https://github.com/erdemarslan/namazvakti)
- Göreme Örenyeri night museum hours ran until 1 November (seasonal), per muze.gov.tr announcements. Seasonal and night schedules are published as announcements, not data. — [muze.gov.tr](https://muze.gov.tr/)

### Inferences
- Cache Open-Meteo responses per ~10 km grid cell per hour on the server. That keeps usage under 10k calls/day even at 10k MAU, and keeps the app within the non-commercial definition as long as it has no ads or subscriptions.
- Ramadan-aware planning (iftar timing, restaurant hours, bayram crowds and closures) can come from Nager.Date bayram dates plus astronomical calculation of imsak and iftar times. Diyanet's published times differ slightly from pure calculation, so label them "approximate".
- Museum closing days: closing days and seasonal hours change, so treat them as curated data with a "last verified" date.

### Gaps
- Biletix, Passo and Bubilet have no public event API documentation. Ticketmaster Discovery API coverage of Turkey (Biletix) could not be confirmed.
- No official Diyanet API terms were found.
- No machine-readable source of museum closing days was found.

## 7. Culinary curation sources (Michelin, Gault&Millau, Bib Gourmand, Culinary Backstreets)

### Takeaway
Michelin's 2026 Türkiye selection (announced 2025-12-04) covers İstanbul, İzmir, Muğla (Bodrum) and newly Kapadokya, with 115 selected establishments overall. Gault&Millau Türkiye 2026 covers 11 cities, more geographically useful (including Gaziantep, Van, Çanakkale, Ankara). Neither offers an API. Restaurant names, awards and outbound links are facts you can reference, but copying their descriptions, photos or logos is not allowed without permission.

### Cited Findings
- Michelin Guide Türkiye 2026 (revealed 2025-12-04):
  - Kapadokya debuts as the 4th destination after İstanbul, İzmir and Muğla, with 18 restaurants.
  - Vino Locale (İzmir/Urla) earned Two Stars, the second in Türkiye after TURK Fatih Tutak.
  - New One Stars: Revithia (Kapadokya), Araf (İstanbul) and Mezra Yalıkavak (Muğla).
  - 16 new Bib Gourmands and 4 Green Stars.
  - 115 selected establishments in total; İstanbul alone has 86 (1 two-star, 8 one-star, 17 Bib Gourmand, 60 Selected).
  - Sources: [MICHELIN Guide article](https://guide.michelin.com/gb/en/article/michelin-guide-ceremony/the-michelin-guide-turkiye-reveals-its-2026-restaurant-selection); [Michelin group press](https://www.michelin.com/en/publications/products-and-services/the-michelin-guide-turkiye-reveals-its-2026-restaurant-selection)
- Sources differ on "54 new restaurants" versus "38 new additions". — [Curly Tales](https://curlytales.com/middle-east/food/michelin-guide-unveils-turkiye-selection-with-new-restaurants-and-new-debut-entries/amp/) vs [Michelin](https://guide.michelin.com/gb/en/article/michelin-guide-ceremony/the-michelin-guide-turkiye-reveals-its-2026-restaurant-selection)
- Gault&Millau Türkiye 2026 (third edition, December 2025):
  - 11 cities: Antalya, Aydın, Balıkesir, Çanakkale, Gaziantep, İstanbul, İzmir, Muğla, Nevşehir, Ankara and Van.
  - Restaurants are scored out of 20, and 11+ earns a "Toque".
  - 4 toques went only to TURK Fatih Tutak and Neolokal.
  - The guide now also covers hotels ("Hôtel Sélectionné").
  - Sources: [Turkish Airlines blog](https://blog.turkishairlines.com/en/gault-millau-turkiye-2026-guide/); [Euronews TR](https://tr.euronews.com/kultur/2025/12/12/turk-mutfagi-dunya-sahnesinde-gaultmillau-2026-odulleri-aciklandi)
- **Older (2025 edition):** 280+ restaurants received toques. — [Ekonomi Gazetesi](https://www.ekonomigazetesi.com/kose-yazisi/turk-mutfagi-kuresel-sahnedeki-yukselisini-surduruyor-44497)

### Inferences
- Store the minimal facts: restaurant name, city, award level, year and source URL. Display "Michelin Guide 2026: Bib Gourmand" with a link to the guide page. Factual award status is low-risk; reproducing review text or photos would infringe copyright and the guides' ToS.
- Combining Michelin/Gault&Millau, coğrafi işaret products and OSM `cuisine=regional/turkish` gives a defensible "taste here" layer without any paid review API.

### Gaps
- Michelin's and Gault&Millau's ToS on linking and referencing were not read directly.
- Culinary Backstreets: no terms or API information was gathered. Treat it as link-only editorial content.
- No 2026–2027 Michelin expansion beyond Kapadokya was announced in the sources found; the next selection is expected around December 2026, which is unverified.

## 8. Maps & tiles for the app (MapLibre + Protomaps/PMTiles, OpenFreeMap, MapTiler, Mapbox; offline)

### Takeaway
MapLibre GL with OpenFreeMap (free, unlimited, no API key, commercial use allowed) or a self-hosted Protomaps PMTiles Turkey extract costs $0. MapTiler's and Mapbox's free tiers are small (MapTiler is non-commercial only) and add vendor lock-in. Offline maps: OpenFreeMap allows bulk downloads of only 3,000 tiles or 50 MB, so offline mode should ship a Turkey PMTiles extract instead.

### Cited Findings
- OpenFreeMap:
  - Unlimited map views and requests, no registration, no API keys, no cookies; commercial use is allowed.
  - Six styles: Positron, Bright, Liberty, Dark, Fiord and 3D.
  - Attribution to OpenFreeMap, OpenMapTiles and OpenStreetMap is required (MapLibre adds it automatically).
  - Offline or bulk downloads are capped at 3,000 tiles or 50 MB per download with a unique User-Agent.
  - Weekly full-planet downloads in Btrfs and MBTiles; MIT-licensed; donation-funded with no SLA.
  - Source: [openfreemap.org](https://openfreemap.org/)
- Protomaps offers the free planet PMTiles file, which can be hosted as a single static file on cloud storage. Its hosted API is free for non-commercial use; commercial use requires GitHub sponsorship. — [protomaps.com](https://protomaps.com/)
- MapTiler Cloud's free plan is limited to non-commercial use and R&D. Aggregators report 5,000 map sessions and 100,000 API requests per month. The service pauses until next month when the quota is hit, and a MapTiler logo is required. — [MapTiler Cloud terms](https://www.maptiler.com/cloud/terms/); [MapTiler pricing](https://www.maptiler.com/cloud/pricing/); [AgentDeals (aggregator)](https://agentdeals.dev/vendor/maptiler-com)
- Mapbox (third-party 2026 summaries): 50,000 free web map loads per month, then about $5/1,000 (about $3/1,000 above 200k). Also 25,000 free mobile MAU and 100,000 temporary geocoding requests. A credit card is required. — [Woosmap: Mapbox pricing 2026](https://www.woosmap.com/blog/mapbox-pricing); [StoreRocket](https://storerocket.io/learn/how-to-use-mapbox-api-free)
- Google Dynamic Maps: $7/1,000 after 10,000 free loads; 2D Map Tiles $0.60/1,000 after 100,000 free. — [Google pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- Yandex MapKit: 25,000 MAU free limit (see section 1). — [Yandex MapKit prices](https://yandex.kz/dev/tariffs/doc/en/mapkit/prices/)

### Inferences
- Recommended: MapLibre (web) and MapLibre Native (mobile), with OpenFreeMap "Liberty" or "Positron" styles online. A Turkey-only PMTiles extract cut from the Protomaps planet build and hosted on object storage serves both offline downloads and a fallback if OpenFreeMap's donation-funded service degrades.
- Avoid MapTiler and Stadia free tiers for public launch. Their "non-commercial" clauses technically fit, but quotas are small and the terms give vendors discretion.

### Gaps
- The official Mapbox pricing page was not fetched, so all Mapbox figures are secondary.
- Turkey-extract PMTiles file size and hosting cost were not measured.

## 9. Licensing pitfalls (ODbL, Google ToS, scraping/KVKK)

### Takeaway
The three big traps:
- **Google**: you cannot store Places content (except place IDs, and lat/lng for 30 days) and cannot show it on a non-Google map.
- **ODbL share-alike**: if OSM POIs are merged with other POIs of the same type in one region into a publicly used database, the merged data must be shared under ODbL. Overture's CDLA-Permissive and FSQ's Apache 2.0 allow this, but you then owe ODbL obligations on the combined POI layer.
- **Scraping**: Turkish law has no safe harbour; ToS, the database right and KVKK all apply.

### Cited Findings
- ODbL clause 4.5(b): using OSM in a Collective Database to create a Produced Work (e.g., a map image) does not create a Derivative Database. The Produced Work can be licensed freely, but recipients may request the OSM data and any Derivative Database used. — [OSMF Horizontal Map Layers guideline](https://osmfoundation.org/wiki/Community_Guidelines/Horizontal_Map_Layers_-_Guideline)
- Collective Database guideline: share-alike applies only to OSM-derived parts when, for a given data type within a regional cut, data is either all OSM or all non-OSM. Mixing OSM restaurants with restaurants from another source produces a Derivative Database that must be shared if publicly used. — [OSMF Collective Database Guideline](https://osmfoundation.org/wiki/Community_Guidelines/Collective_Database_Guideline_Guideline); [OSM wiki Horizontal Layers](https://wiki.openstreetmap.org/wiki/Open_Data_License/Horizontal_Layers_-_Guideline)
- These are community guidelines, not legal rulings, and some contributors dispute parts of them. — [OSM-talk 2019](https://lists.openstreetmap.org/pipermail/talk/2019-September/083274.html)
- AnythingPOI Türkiye, which fused OSM and Overture, is itself published under ODbL with attribution to both. This shows the share-alike outcome in practice. — [Zenodo AnythingPOI Türkiye](https://zenodo.org/records/20013733)
- Overture applies per-feature licences: CDLA-Permissive-2.0 for most, Apache-2.0 for Foursquare-sourced and CC0 for AllThePlaces. — [Overture Places guide](https://docs.overturemaps.org/guides/places)
- Google: place IDs may be stored indefinitely; lat/lng only for 30 days; no use with non-Google maps; logo or "Google Maps" attribution is mandatory. — [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies); [Maps Service Terms 2025-05-01](https://cloud.google.com/archive/maps-platform/terms/maps-service-terms-20250501)
- Open-Meteo (CC BY 4.0) and İBB Açık Veri Lisansı (CC BY 4.0-compatible) both require attribution. — [Open-Meteo terms](https://open-meteo.com/en/terms); [İBB licence](https://data.ibb.gov.tr/license)
- Booking.com's partner terms reportedly restrict AI systems without prior written approval (secondary source). — [VorpLabs](https://vorplabs.com/agent-tools/booking-demand-api)
- Turkey has no specific scraping law. Risk comes via TCK, KVKK, contract/ToS, the database right and unfair competition (secondary sources). — [Mondaq](https://mondaq.com/turkey/copyright/1304746/web-scraping-and-protection-of-websites); [law.ungovr.org (low reliability)](https://law.ungovr.org/ai/tr)

### Inferences
- The simplest compliant design is to publish the merged POI database (OSM + Overture + FSQ OS + the app's own curation) under ODbL as a downloadable dump. That is cheap for a non-commercial project and also builds goodwill. The alternative is to keep OSM POIs and non-OSM POIs in separate layers per category and region. The app's map rendering and itineraries are Produced Works and need only attribution.
- Do not mix Google content into this database. Keep Google, if used at all, as transient, on-demand display with no persistence beyond the place_id.
- User data (trip history, location, feedback) falls under KVKK. It needs an aydınlatma metni and explicit consent for location tracking, and cross-border transfer rules apply if hosted outside Turkey (not researched in depth here).

### Gaps
- No Turkish case law on scraping travel or review sites was found.
- KVKK cross-border transfer rules after the 2024 amendments were not researched here.

## 10. Recommended "stack of sources" and estimated monthly cost (100 / 1,000 / 10,000 MAU)

### Takeaway
An open-data-first stack costs about $0 in API and data fees at 100 and 1,000 MAU. At 10,000 MAU the API cost is still about $0, but self-hosted routing (and the POI database) needs a server whose price was not sourced here (see Gaps). Adding Google Places/Maps/Routes enrichment costs about $20 at 100 MAU, about $670 at 1,000 MAU and up to about $8,000 at 10,000 MAU at list prices. That is unaffordable for a zero-revenue app, so paid APIs should be opt-in, narrow and rate-limited.

### Cited Findings
Unit prices used in the estimates below, all cited above:
- Google:
  - Place Details Enterprise $20/1,000 after 1,000 free.
  - Dynamic Maps $7/1,000 after 10,000 free.
  - Compute Routes Essentials $5/1,000 after 10,000 free.
  - Source: [Google pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- Gemini Maps grounding: 5,000 free per month, then $14/1,000 queries. — [Gemini Maps grounding](https://ai.google.dev/gemini-api/docs/maps-grounding)
- Foursquare Pro: 500 free per month, then $15/1,000. — [Foursquare pricing](https://foursquare.com/products/pricing/)
- Free tiers:
  - ORS Standard: 2,000 directions/day. — [ORS plans](https://openrouteservice.org/plans/)
  - Open-Meteo: under 10,000/day. — [Open-Meteo terms](https://open-meteo.com/en/terms)
  - OpenFreeMap: unlimited. — [OpenFreeMap](https://openfreemap.org/)

### Inferences
**Recommended stack (v1, zero-revenue):**
1. **POI base:** Overture Places (TR filter) + FSQ OS Places + OSM (taginfo counts above), deduplicated into PostGIS. Publish the merged database under ODbL. Add hand-curated layers: Michelin/Gault&Millau awards (facts and links), coğrafi işaret products by il/ilçe, museum fees and closing days (Ministry tariff), and çay bahçeleri (OSM name search plus curation).
2. **Map:** MapLibre with OpenFreeMap. Offline uses a Turkey PMTiles extract (Protomaps build).
3. **Routing:** ORS Standard while small; switch to a self-hosted Valhalla or OSRM (Turkey extract) before about 1,000 MAU. Use GTFS (İETT, İzmir, Kocaeli, FlixBus TR, KentKart community feeds) for city and intercity public transport where available.
4. **Weather:** Open-Meteo with server-side caching. **Holidays:** Nager.Date. **Prayer/iftar:** calculated and labelled approximate.
5. **Budget data:** a curated toll table (KGM/KÖİ, updated January and July), EPDK fuel bulletin price per il (manual or weekly), and museum fees (EUR for foreigners, MüzeKart for citizens).
6. **Accommodation, transport tickets, events:** deep links only (Booking, Etstur, oBilet, TCDD, Biletix, Google Maps URLs). No paid API.
7. **Optional enrichment (feature-flagged, per-user daily cap):** Gemini Maps grounding (first 5k/month free) or Google Place Details Pro to confirm `businessStatus` before including a venue. Never store results beyond place_id. Never show the result on the MapLibre map.

**Estimate assumptions per MAU per month:** 2 trip plans, 40 route computations (including re-plans), 30 map sessions, 20 place-detail views, weather cached server-side. All figures are list prices, before Google volume discounts, and exclude LLM tokens and hosting.

| Scenario | 100 MAU | 1,000 MAU | 10,000 MAU |
|---|---|---|---|
| A. Open stack (OpenFreeMap + ORS/self-host routing + open POI DB + Open-Meteo) | $0 API | $0 API (ORS ~1,333 req/day avg is within the 2,000/day cap; self-host recommended for peaks) | $0 API; ~400k routes/month exceeds ORS, so self-hosted routing is required (cost = server; price not sourced) |
| B. Hybrid Google (Place Details Enterprise for rating/hours + Dynamic Maps + Routes Essentials) | ~$20 (2k details → $20; 3k map loads and 4k routes free) | ~$670 ($380 details + $140 maps + $150 routes) | up to ~$7,960 (≤$3,980 details + ≤$2,030 maps + ≤$1,950 routes; lower with volume discounts) |
| C. Gemini Maps grounding only (≈20 Maps queries/MAU) | $0 (2k ≤ 5k free) | ~$210 (15k × $14/1k) | ~$2,730 (195k × $14/1k) |
| D. Foursquare Pro enrichment (20 lookups/MAU) | ~$23 | ~$293 | ~$2,693 (tiered $15→$12) |

- At 100–1,000 MAU, Scenario A plus a tightly capped Scenario C (a "verify still open" call only for the final itinerary stops, e.g., ≤5 per trip, so ≈10/MAU) stays within free allowances up to about 500 MAU, with roughly $70/month of overage at 1,000 MAU.
- Google Maps Platform public-program credits target organisations (nonprofit, startup and others). An individual developer would likely need a legal entity, such as a dernek, to apply; this is unverified.

### Gaps
- Server and hosting costs (VPS for PostGIS + Valhalla/OSRM for Turkey, object storage for PMTiles) were not sourced; for the cost table they need a separate price check.
- Usage assumptions per MAU are illustrative, not based on observed data from comparable Turkish apps.
- Google volume-discount rates above 100k events were not captured, so the 10k-MAU Google figures are upper bounds.
