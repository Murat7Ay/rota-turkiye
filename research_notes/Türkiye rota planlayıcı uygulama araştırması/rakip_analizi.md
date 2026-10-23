# Competitive landscape: travel discovery and trip-planning apps for a Turkey-focused AI trip planner (as of October 2026)

Research date: 2026-10-23. Every item below carries its source date where known. Anything dated before 2025 is flagged **[OLDER]**. Where sources conflict or rest on one vendor or blog, that is noted.

---

## 1. Global discovery/review platforms (Google Maps + Gemini/Ask Maps/AI Mode, Tripadvisor, Foursquare/Swarm, Yelp, Michelin): strengths and Turkey-specific failures

### Takeaway
Google Maps, now with Gemini "Ask Maps" (launched March 2026), is the strongest general competitor and the data backbone most planners depend on. Its AI trip features launched in the US and India first, and I could not confirm that Ask Maps' multi-day planning is live in Türkiye. Its main weakness in Türkiye is trust: inflated or paid reviews around tourist hubs, and anti-fake-review measures that were UK-first. Tripadvisor's AI is mostly US-only hotel search inside ChatGPT. Foursquare City Guide, once widely used in Türkiye, shut down in 2024–25. Michelin and Gault&Millau give a high-trust signal, but only for a small slice of Türkiye.

### Cited Findings
**Google Maps / Gemini**
- Ask Maps, a Gemini-powered chat inside Google Maps, launched on 12 March 2026 on iOS and Android in the **US and India only**. It plots a multi-stop road trip and returns a day-by-day itinerary with waypoints, stop details, packing tips and toll information. It personalizes from search history and saved places. The article does not mention reservations or opening-hours handling. — [PCWorld, 12 Mar 2026](https://www.pcworld.com/article/3086987/gemini-just-became-your-new-google-maps-buddy.html)
- Google says Ask Maps draws on information from 300M+ places, including community reviews. — [Noqta, 2026](https://www.noqta.tn/en/news/google-maps-gemini-ai-ask-maps-immersive-navigation-2026)
- A worldwide rollout was planned "over the following months". — [Thairath, 2026](https://en.thairath.co.th/lifestyle/tech/2919868)
- In June 2026 Ask Maps rolled out to "several markets", which the source does not name; Türkiye is not mentioned. In app code it is being built into route planning, with AI suggestion bubbles such as "most scenic route?" and "best time to leave to avoid traffic?". This was **experimental and not widely available**, and public transit gets no such prompts. — [Ubergizmo, 15 Jul 2026](https://www.ubergizmo.com/2026/07/google-maps-gets-ask-maps-gemini-ai-to-plan-your-travels/)
- Immersive Navigation, the 3D driving view, was US-only at launch. — [PCWorld, Mar 2026](https://www.pcworld.com/article/3086987/gemini-just-became-your-new-google-maps-buddy.html)
- Earlier Gemini-in-Maps "Ask Maps about this place" Q&A was first rolled out to US Android and iOS users. — [Webrazzi, 1 Nov 2024](https://webrazzi.com/2024/11/01/google-haritalara-gemini-tarafindan-desteklenen-yeni-yapay-zeka-ozellikleri-entegre-ediliyor/) **[OLDER]**
- Google Search AI Mode includes "Canvas" trip plans. These build an itinerary in a side panel from flight and hotel data, Maps photos and reviews, and web content, and support follow-up tradeoff questions. Canvas was rolled out to **US desktop users opted into AI Mode in Labs**. Agentic booking covers restaurants, events and wellness via OpenTable, Resy, Ticketmaster, StubHub and Fresha for **US users**. Flight and hotel booking through Booking.com, Expedia, Marriott and Wyndham was announced as a future plan. — [Search Engine Journal, ~Nov 2025](https://www.searchenginejournal.com/google-extends-ai-travel-planning-and-agentic-booking-in-search/)
- No launch date had been set for Google's agentic hotel and flight booking in AI Mode. — [Hospitality Net](https://www.hospitalitynet.org/external/4130037/agentic-ai-for-travel-heats-up-as-google-preps-booking-tools)

**Google reviews in Türkiye: trust problems**
- An r/istanbul post describes a restaurant whose number of high ratings exceeded those of Michelin-starred places, while its low-star reviews alleged paid reviews. The poster asked for a trustworthy Turkish review site because they "didn't trust Google". Commenters called most Sultanahmet restaurants poor value and pointed to locally oriented places instead. — [r/istanbul via redlib, Sep 2024](https://axebps-redlib.hf.space/r/istanbul/s/D8rThSu7Fg) **[OLDER, anecdotal]**
- Recurring Istanbul tourist traps compiled from Reddit reports include shoe-shine "drops" near Galata Bridge and İstiklal and carpet-shop pipelines around Sultanahmet. — [Tabiji scam guide, 2026](https://tabiji.ai/scams/istanbul/). Overpriced private Bosphorus cruises are another; public ferries are the suggested alternative. — [Outlook Traveller](https://www.outlooktraveller.com/destinations/international/tourist-traps-to-avoid-in-t%C3%BCrkiye-a-first-timers-guide)
- Google's fake-review penalties add a profile notice ("Bu işletmeden sahte yorumlar kaldırıldı"), block new reviews and remove existing ones. In Sept 2024 these were **live only in the UK**, with a global rollout planned but no timeline. — [Webrazzi, 27 Sep 2024](https://webrazzi.com/2024/09/27/google-haritalar-sahte-yorumlara-sahip-isletmeleri-isaretleyecek/) **[OLDER]**
- In 2025 the Turkish Ministry of Trade's Reklam Kurulu ruled against unverifiable or manipulated restaurant and facility reviews. Sellers must verify that reviewers are actual customers. Google said the ruling affects third-party sites that embed Google reviews, not Google Maps, and that the Maps review system continues to work. — [Forbes Türkiye, 2025](https://www.forbes.com.tr/teknoloji/google-dan-reklam-kurulu-aciklamasi-yorumlar-ozelligine-yasak-getirilmedi); [İndigo Dergisi, Feb 2025](https://indigodergisi.com/2025/02/google-turkiye-reklam-kurulu-karariyla-ilgili-aciklama/)
- A study found ChatGPT itineraries recommended temporarily or permanently closed venues in 24% of cases. That reflects the stale place data that any planner on top of Maps or web data inherits; see section 3. — [Travolution, 2025](https://travolution.com/news/marketing/survey-finds-chatgpt-itineraries-to-be-riddled-with-inaccuracies)

**Yandex Haritalar / Navi: a strong local mapping competitor**
- In August 2026 Yandex added conversational place search to Yandex Haritalar and Yandex Navi in Türkiye, through the Yandex AI icon or a "Haritalara Sor" option, in **Turkish and English**. It combines descriptions, photos, ratings and reviews with constraints such as area, time, quietness and outdoor preference, then routes by car, transit or on foot. Refinement happens in the same chat. **Multi-stop routing is not mentioned**, and no Türkiye traffic-model accuracy figures were published. — [Teknoblog, 5 Aug 2026](https://www.teknoblog.com/yandex-haritalar-yapay-zeka-ile-rota-hazirliyor/)
- Yandex.Navigasyon became one of the most-used navigation apps in Türkiye after Yandex entered the market. — [İndigo Dergisi, Aug 2016](https://indigodergisi.com/2016/08/turkiye-dijital-harita-karsilastirmasi/) **[OLDER]**

**Tripadvisor**
- The Tripadvisor app inside ChatGPT is open to logged-in ChatGPT users **in the US only**, with expansion "in progress". It searches hotels worldwide, shows them on a map, and hands booking off to Tripadvisor or partners. — [Tripadvisor.com/ChatGPT](https://www.tripadvisor.com/ChatGPT)
- A third-party review says the app lacks restaurants, activities and cruises. — [Jotform, 2026](https://www.jotform.com/ai/best-chatgpt-travel-apps/)
- Tripadvisor's earlier AI itinerary generator was a US-only beta. — [Travel Noire](https://travelnoire.com/tripadvisor-ai-tool) **[OLDER, likely 2023]**
- OpenAI's Apps SDK launched in Oct 2025 with Expedia and Booking.com; Tripadvisor, Uber and TheFork were announced as "coming soon". — [PhocusWire, Oct 2025](https://www.phocuswire.com/openai-chatgpt-apps-expedia-booking-tripadvisor); [Skift, 6 Oct 2025](https://skift.com/2025/10/06/expedia-booking-chatgpt-apps-openai/)

**Foursquare / Swarm**
- Foursquare shut the City Guide mobile app on 15 Dec 2024 and its web version on 28 Apr 2025 to focus on the Swarm check-in app. City Guide's business listings still appear in Swarm, and data export remains available. — [Foursquare City Guide Sunset](https://foursquare.com/city-guide-sunset/); [Foursquare support](https://support.foursquare.com/hc/en-us/articles/17402902423708-City-Guide-Sunset); [The Register, Nov 2024](https://www.theregister.com/2024/11/27/foursquare_to_close/)
- One report says Foursquare would open its Places database to the public. — [The Register, Nov 2024](https://www.theregister.com/2024/11/27/foursquare_to_close/) (single source, not verified)

**Michelin Guide Türkiye**
- The 2026 selection was announced on 4 Dec 2025. It has 2 two-star restaurants (Vino Locale in Izmir and TURK Fatih Tutak in Istanbul), 15 one-star (new: Revithia in Cappadocia, Araf in Istanbul, Mezra Yalıkavak in Muğla), 39 Bib Gourmand and 4 new Green Stars (TURK Fatih Tutak, Orfoz, Teruar Urla, Babayan Evi). There are 54 new restaurants, 18 of them in Cappadocia. **Covered destinations: Istanbul, Izmir, Muğla (Bodrum, Yalıkavak, Datça, Fethiye), Cappadocia only.** — [Michelin Guide, 4 Dec 2025](https://guide.michelin.com/gb/en/article/michelin-guide-ceremony/the-michelin-guide-turkiye-reveals-its-2026-restaurant-selection); [Michelin: Cappadocia joins, Sep 2025](https://guide.michelin.com/tr/en/article/news-and-views/cappadocia-joins-the-michelin-guide-in-turkiye-video)
- Totals conflict. Turkish Airlines reports 170 restaurants and 17 starred. — [Turkish Airlines blog](https://blog.turkishairlines.com/en/a-gastronomic-perspective-on-travel-turkiyes-michelin-starred-restaurants/). The 17 starred matches Michelin's 2+15, but the total selection count is unverified.

**Gault&Millau Türkiye**
- The 2026 Gault&Millau Türkiye awards (Dec 2025) cover **11 provinces**, including Istanbul, Antalya, Ankara, Gaziantep, İzmir and Muğla. Restaurant of the Year went to Teruar Urla; street-food prize to Akali (Istanbul); seafood prize to Kıyı. — [Euronews TR, 12 Dec 2025](https://tr.euronews.com/kultur/2025/12/12/turk-mutfagi-dunya-sahnesinde-gaultmillau-2026-odulleri-aciklandi)
- 280+ restaurants received "toques" in the 2025 Gault&Millau Türkiye guide. — [Ekonomi Gazetesi](https://www.ekonomigazetesi.com/kose-yazisi/turk-mutfagi-kuresel-sahnedeki-yukselisini-surduruyor-44497)

### Inferences
- Google's AI planning is the biggest long-term threat. It owns the place graph, live traffic and reviews, and Ask Maps is moving into route planning. Its gaps for a Türkiye user in Oct 2026 are:
  - unconfirmed availability of Ask Maps and Canvas multi-day planning in Türkiye and in Turkish;
  - no in-trip "you skipped X, here is Y" adaptive layer;
  - review signals that are weakest exactly where tourists go (Sultanahmet, Kapadokya and coastal hubs).
- A Turkey app should not try to out-collect Google's place data. It should **re-rank** Google, Yandex and OSM data with trust signals Google lacks: Michelin/Bib, Gault&Millau, Ekşi/Reddit/local-blog mentions, review-velocity anomaly checks, and a "tourist-trap risk" score for known hotspots.
- Michelin and Gault&Millau cover a few hundred restaurants concentrated in four to eleven provinces. Most of the 81 provinces and most everyday categories (esnaf lokantası, çay bahçesi/ocağı, kahvaltı salonu, pazar, çarşı) have no expert-curated layer. That is the curation gap.
- Foursquare's City Guide shutdown removed the discovery app many Turkish users historically used for "where do locals go" lists. Swarm survives, but as a check-in app.
- Yandex AI in Yandex Haritalar is a Turkish-language competitor for single-place discovery, but per the August 2026 report it does not do multi-day, multi-stop planning.

### Gaps
- No official Google statement found on whether Ask Maps trip planning, or the Search AI Mode Canvas planner, is available in Türkiye or in Turkish as of Oct 2026. A search summary pointed to a Google Türkiye blog post with a Turkish Maps query example ("Arkadaşlarla İstanbul'da gidilecek restoranlar"), but I did not verify it.
- No systematic study of fake Google reviews in Türkiye was found; the evidence is anecdotal.
- Yelp: no source found on any Yelp presence or relevance in Türkiye in 2025–26.
- Michelin Guide app features and whether the guide will expand to a national Türkiye selection: one search summary claimed nationwide coverage "starting next year", but Michelin's own article did not confirm it.

---

## 2. Trip planners (Wanderlog, Stippl, Polarsteps, TripIt, Roadtrippers, Sygic/Tripomatic, Visit a City, Tripadvisor, Booking.com, Expedia, Airbnb, Klook/GYG)

### Takeaway
The established planners are generic "list + map + collaboration + paywalled offline" tools. Several are weak or absent in Türkiye: Roadtrippers reportedly covers only the US, Canada, Australia and NZ. The OTAs (Booking, Expedia, Airbnb) are still building or acquiring planning layers in 2026 and focus on the booking funnel, not in-destination daily guidance. No planner was found that offers an "every morning, here is today's plan" guide mode or automatic replacement of a skipped item.

### Cited Findings
**Wanderlog**
- Pro costs $39.99/yr and includes mobile offline access. The App Store rating is reported at 4.9 stars from 33,000+ ratings. — [Endless Travel Plans, Jul 2026](https://www.endlesstravelplans.com/guides/planning-tools/wanderlog-review)
- Trustpilot complaints (small, self-selected sample):
  - yearly-only roughly $40–50 pricing, with users preferring a lifetime option;
  - document attachments and offline mode locked behind the paywall;
  - an unexpected $60 charge and renewal without warning;
  - Premium features apply only to the payer, not the group;
  - sync problems and mobile bugs ("riddled with bugs");
  - no export to Word or Excel.

  — [Trustpilot: wanderlog.com](https://trustpilot.com/review/wanderlog.com)
- Wanderlog combines route maps, reservations import, group collaboration and expense tools, but its booking integration is limited. — [Lindy roundup, 2026](https://www.lindy.ai/blog/trip-planner-app) (vendor blog, caution)

**Stippl / Polarsteps / TripIt / Roadtrippers**
- Stippl markets itself as all-in-one: AI itinerary, budget, packing list and expenses. — [Stippl blog, 2026](https://app.stippl.io/blog/best-travel-planning-apps-2026) (self-published, biased)
- TripIt's job is organizing bookings from forwarded confirmation emails; it does not plan routes. — [Stippl blog, 2026](https://app.stippl.io/blog/best-travel-planning-apps-2026)
- Wanderlog, Stippl, Polarsteps and TripWaffle can all turn confirmation emails into organized plans; they differ in AI planning, maps, collaboration, trip tracking, alerts and pricing. — [TechPP, 22 Sep 2026](https://www.techpp.com/2026/09/22/best-ai-travel-planners-that-sync-with-your-confirmation-emails/) (from search snippet; the page returned 403 on fetch)
- Polarsteps: a travel planner, digital map and printed travel book of trip memories. Its core is tracking and sharing a trip, not planning it. — [CB Insights](https://www.cbinsights.com/compare/polarsteps-vs-stippl)
- Roadtrippers plans driving routes with attractions, viewpoints, restaurants and fuel stops plus route optimization. — [Stippl blog, 2026](https://app.stippl.io/blog/best-travel-planning-apps-2026)
- A third-party review says the Roadtrippers app **covers only the USA, Canada, Australia and New Zealand**. — [PilotPlans review](https://pilotplans.com/blog/roadtrippers-review) (undated; the official FAQ "What countries does Roadtrippers support?" exists at [support.roadtrippers.com](https://support.roadtrippers.com/hc/en-us/categories/360004363351-FAQs) but its content was not retrieved)

**Tripomatic (formerly Sygic Travel)**
- Sygic Travel was renamed Tripomatic. **Offline use, unlimited offline maps, walking navigation and AI travel planning sit behind Tripomatic Premium.** Trips sync across devices and the web planner. — [App Store: Tripomatic](https://apps.apple.com/app/tripomatic/id519058033)

**Booking Holdings**
- Booking.com's original AI Trip Planner (ChatGPT-based) launched as a **US beta in June 2023**. — [Business Today, Jun 2023](https://www.businesstoday.in/amp/technology/news/story/ai-travel-planner-bookingcom-to-use-chatgpt-to-help-plan-itineraries-book-tickets-387352-2023-06-28) **[OLDER]**
- As of Sept 2026, Booking Holdings runs five AI efforts:
  - Priceline's Penny, revamped into an agentic system;
  - an Agoda trip-planning tool "in the near future";
  - a Booking.com trip-planning tool **still in development**, aimed at the funnel "from booking upward" so it does not disrupt conversion;
  - two stealth startups (Lola.com, led by Kayak co-founders, and an unnamed West Coast venture).

  — [Skift, 14 Sep 2026](https://skift.com/?p=838262)
- Booking.com and Expedia apps inside ChatGPT show real-time hotel and flight prices and maps, but **bookings complete on the brands' own sites**. — [PhocusWire, Oct 2025](https://www.phocuswire.com/openai-chatgpt-apps-expedia-booking-tripadvisor)

**Expedia**
- Expedia Group acquired Layla, a Berlin AI trip planner founded in 2023 that builds itineraries across flights, lodging, activities, dining and transport via a conversational agent. Terms were undisclosed. Layla keeps operating alongside Expedia, Hotels.com and Vrbo. One report dates the deal to July 2026. — [Travolution](https://www.travolution.com/news/travel-sectors/intermediaries/expedia-group-acquires-layla-to-accelerate-ai-trip-planning/); [Hospitality Net](https://www.hospitalitynet.org/news/4133792/expedia-group-acquires-layla-accelerating-its-ai-powered-trip-planning-and-booking-strategy); [I amsterdam Startup Map](https://startupmap.iamsterdam.com/news/note/expedia-buys-berlin-ai-trip-planner-layla-to-speed-up-agent-rollout)

**Airbnb**
- On its Q4 2024 earnings call, Airbnb's CEO said it was still too early for agent-based trip planning and that AI would go into customer support first. — [AI Magazine](https://aimagazine.com/news/tripadvisor-airbnb-can-ai-agents-beat-travel-agents) **[OLDER]**

### Inferences
- Pain points in the established planners that a free app can beat outright:
  - offline mode behind a paywall (Wanderlog, Tripomatic);
  - group features that only work for the payer;
  - billing surprises;
  - weak export.
- A free, offline-first app with no paywall already beats these on the most-cited complaint.
- None of these products is **adaptive during the day**. They are static lists with a map. Polarsteps tracks where you were; it does not re-plan.
- OTAs want to sell bookings. Their planners optimize toward their own hotels and flights and away from free or cheap local options (çay bahçesi, pazar, esnaf lokantası, free viewpoints). A non-commercial app has no such conflict of interest, and that is a credible positioning point.
- Roadtrippers is the closest concept to "draw a multi-day road trip with stops", and it reportedly does not cover Türkiye. That leaves the 81-province road-trip use case open, apart from the Routevia and Yandex newcomers in section 4.

### Gaps
- Expedia **Romie**: no 2025–26 source found on its current status or availability. It may have been folded into the Layla acquisition, which is unconfirmed.
- **Visit a City**: no current status or feature info found.
- **Klook / GetYourGuide** itinerary features: not researched due to tool-call budget; no source.
- Current Polarsteps, Stippl and TripIt pricing and 2026 independent reviews were not found.
- Airbnb 2025–26 AI planning features: nothing found beyond the 2024 earnings-call remark.

---

## 3. AI-native planners (Mindtrip, Layla, Wonderplan, iPlan.ai, TripGenie, ChatGPT/Gemini/Claude, newcomers): real-time re-planning, opening hours, travel times, budget

### Takeaway
AI planners in 2026 are good at a first draft and at chat-based refinement, and they are converging on booking: Mindtrip Flights (May 2026), Layla now inside Expedia, and OTA apps inside ChatGPT. They remain weak on factual freshness (closed venues, wrong hours, impossible routing) and on true in-trip re-planning. No source shows any of them proactively replacing a missed or skipped plan item based on location, opening hours and remaining budget.

### Cited Findings
- **Accuracy:** SEO Travel asked ChatGPT for 2-day itineraries in 10 cities, with 10 itineraries per city.
  - 90% contained at least one error.
  - 24% recommended temporarily or permanently closed venues.
  - About half scheduled visits outside opening hours; for example, a Tokyo café was booked for 8 a.m. but opens at noon.
  - Some recommended non-existent places, such as a made-up eatery in Rome.
  - About a quarter forced backtracking or long detours.
  - Caveat: a small, commissioned study of one model at one point in time.

  — [Travolution, 2025](https://travolution.com/news/marketing/survey-finds-chatgpt-itineraries-to-be-riddled-with-inaccuracies)
- A Turkish OTA blog warns that AI "is very smart but not always up to date" and may recommend a hotel that has closed. — [Turna blog](https://www.turna.com/blog/?p=25131)
- One in three travelers already uses AI to plan trips. Rome2Rio and Omio launched ChatGPT apps that use live operator data for trains, buses, flights and ferries, not AI estimates. Omio's CEO says last-minute changes may cost more. Risks named: hallucinations, AI concentrating everyone on the same popular routes, and loss of spontaneity. The article contains **no Türkiye-specific data**. — [Euronews TR, 11 Apr 2026](https://tr.euronews.com/2026/04/11/yapay-zeka-turizmi-nasil-etkiledi-seyahatleri-chatgpt-planladi)
- 29% of US consumers use AI services to plan trips (Adobe data). — [eMarketer](https://www.emarketer.com/content/expedia-booking-com-integrations-push-chatgpt-deeper-commerce)
- A 2026 roundup says autonomous booking is "still mostly a demo"; OpenAI pulled back from in-chat checkout, so tools hand off to booking sites. It recommends a layered approach: a research tool, an itinerary tool and a booking site. — [Fast.io, 2026](https://fast.io/resources/best-ai-for-travel-planning-2026/) (third-party roundup)

**Mindtrip**
- Mindtrip Flights launched on **6 May 2026**, powered by Sabre Mosaic with PayPal checkout, and targets group trips from multiple departure cities and last-minute itinerary changes. — [Sabre investor release](https://investors.sabre.com/node/19876); [TravelDailyNews](https://www.traveldailynews.com/technology/mindtrip-launches-ai-powered-flight-booking-platform/)
- Mindtrip Stays (July 2026) adds conversational hotel discovery and price-drop alerts. Group itineraries support real-time chat, comments and co-editing. — [Stork.ai listing](https://www.stork.ai/en/mindtrip) (directory; not independently verified)
- One reviewer says Mindtrip's restaurant picks skew toward tourist spots. — [Lindy roundup, 2026](https://www.lindy.ai/blog/trip-planner-app) (vendor blog, caution)

**Layla**
- Layla builds day-by-day itineraries across flights, hotels, car rentals and activities, with booking through partners. It was acquired by Expedia (see section 2). — [Travolution](https://www.travolution.com/news/travel-sectors/intermediaries/expedia-group-acquires-layla-to-accelerate-ai-trip-planning/)
- Trustpilot: 3.5/5 from 49 reviews, mixed. Some reviewers say it failed to produce a usable plan. — [Trustpilot: layla.ai](https://ca.trustpilot.com/review/layla.ai)

**Trip.com TripGenie**
- TripGenie launched in July 2023 with text and voice input, itinerary planning and in-app booking. — [TTG Asia, Jul 2023](https://www.ttgasia.com/2023/07/26/trip-com-introduces-ai-travel-assistant-tripgenie/) **[OLDER]**. No independent 2026 review was found.

**Wonderplan and others**
- Roundups describe Wonderplan as strong on budget breakdowns but with no booking, and GuideGeek as planning inside messaging apps. ChatGPT is good for brainstorming but cannot book on its own. — [Unite.AI](https://www.unite.ai/best-ai-tools-for-travel-planning/); [Lindy](https://www.lindy.ai/blog/trip-planner-app) (roundups, low evidentiary weight)

**Wanderboat**
- Wanderboat is a chat and discovery AI planner that tailors routes and accommodation by budget, dates and interests. It is **not** Turkish. — [Webrazzi, 5 Sep 2025](https://webrazzi.com/2025/09/05/seyahat-planlama-sureclerini-kolaylastiran-yapay-zeka-cozumu-wanderboat/)

### Inferences
- The universal weak point is **verification against reality**: hours, closures and travel-time feasibility. A Turkey app that validates every plan item against fresh place data and real routing before showing it would beat the chat-only planners on the failures users actually experience. Place data would come from the Google Places or Yandex APIs, routing from OSRM or Google, and closure flags from recent-review recency.
- Nothing found does **event-driven re-planning** (trigger: the user skipped or is late; action: rebuild the rest of the day while respecting hours, distance and budget). Mindtrip's "last-minute changes" relates to flights. Google's in-route Ask Maps prompts were experimental as of July 2026. This is the clearest functional differentiator.
- Budget handling in AI planners is mostly an estimate at planning time ("budget-friendly options"). None tracks actual spend against plan during the trip and adjusts the next recommendations.
- Expect generalist LLMs (ChatGPT, Gemini, Claude) with OTA apps to become the default first-draft tool. The Turkey app's moat must lie in local data plus in-trip behavior, not first-draft generation.

### Gaps
- iPlan.ai: no source found.
- No independent benchmark of 2026 planner accuracy for Türkiye destinations was found.
- No source tested Gemini or Claude trip-planning accuracy specifically.
- ChatGPT's in-chat checkout pullback rests on one third-party roundup and was not confirmed with OpenAI.

---

## 4. Turkey-specific products (GoTürkiye, Türkiye'nin Müzeleri/Müzekart, Etstur/Tatilbudur/Jolly/Enuygun/Obilet, Turkish route and food guides, Turkish AI planners)

### Takeaway
The official GoTürkiye portal is a promotional content site with a "Route / plan your trip" section. Its iOS app looks stale: last update July 2024 and too few ratings to show a score. Turkish OTAs are booking engines; Enuygun exposes flights, hotels, buses and car rental via an MCP server (2025) but has no itinerary planner. 2026 brought **small direct competitors**:
- Routevia, an indie AI day-by-day planner covering all 81 provinces;
- Optiviser Trip, a Turkish AI planner with ads and a business panel;
- Tatil Planlama AI;
- Yandex's "Trip AI Agent" in the Yandex AI app in Türkiye, which reportedly includes multi-stop routing with live traffic and budget estimates.

None shows traction or independent reviews yet.

### Cited Findings
**GoTürkiye (TGA + Ministry of Culture and Tourism)**
- GoTürkiye is a one-stop platform with content personalized to user profile and consumption habits, routes and itineraries built around a "five senses" experience, and a Route / plan-your-trip section. It also has events, sustainable destinations, mini-series, blogs and Go Türkiye TV. It covers all 81 provinces and thematic tourism (gastronomy, religious, fashion and shopping, camping, blue cruise, cycling, golf, ski). The press release claims 3M monthly visitors. **No maps, booking or AI features are mentioned.** — [GoTürkiye press release (page footer ©2026, release undated)](https://goturkiye.com/branding/press-releases/global-tourism-information-platform-of-turkiye)
- The platform offers 61 experience products in 10 languages. — [Habertürk](https://www.haberturk.com/basligi-turkiye-yi-22-milyon-kisi-takip-ediyorhaber-spotu-3868218)
- GoTürkiye iOS app (developer: Türkiye Turizm Tanıtım ve Geliştirme Ajansı):
  - v1.0 released 6 May 2024; latest v1.1.0 on 3 Jul 2024 ("Improvements have been made");
  - **not enough ratings to display a score**;
  - listed language English;
  - 44.1 MB;
  - the visible description does not mention routes, maps, offline use or AI.

  — [App Store: GoTürkiye](https://apps.apple.com/us/app/-/id6478965187) (US storefront, fetched Oct 2026; I read the dates as US MM/DD format)
- An automated third-party scan rated goturkiye.com 66/100 ("Moderate Risk"), citing privacy compliance and security configuration. This was not a formal audit. — [OffSeq report](https://guard.offseq.com/report/goturkiye-com-risk-assurance-report)

**Türkiye'nin Müzeleri app / Müzekart**
- Müzekart gives a year of entry to 350+ museums and ören yeri for 200 TL for citizens (2025 price). — [Habertürk, 2025](https://www.haberturk.com/muzekart-ile-200-tlye-350den-fazla-muze-ziyareti-3856858)
- It can be bought digitally via e-Devlet or the "Türkiye'nin Müzeleri" app, and the digital card requires user identification in the app. — [KTB Müzekart PDF](https://www.ktb.gov.tr/Eklenti/123238,muzekartpdfpdf.pdf)
- Sales rose from ~1.08M (2017) to ~6.74M (2025). — [Dünya](https://www.dunya.com/sektorler/turizm/turkiye-muzecilikte-avrupanin-onune-gecti-haberi-827901)
- About 26M Müzekart visits were made in 2025. — [Posta](https://www.posta.com.tr/kultur-sanat/turkiyenin-kulturel-miraslarina-yil-boyu-erisim-imkani-muzekart-ile-200-tlye-350den-fazla-muze-ziyareti-yapabilirsiniz-2959348)
- Some sites are excluded from Müzekart, e.g. Topkapı Harem, Aya İrini and Sedir Adası. Certain groups enter free (under 18, over 65, teachers, veterans, disabled). — [İGA blog](https://www.istairport.com/blog/muzekart-ile-ilgili-merak-ettiginiz-her-sey) (exclusions may change yearly)

**Turkish OTAs**
- In 2023 Enuygun launched ENBot, a GPT-4-based assistant for flight search, on its homepage and app. — [Webrazzi, Apr 2023](https://webrazzi.com/2023/04/12/enuygun-gpt-4-ile-egitilerek-tasarlanmis-seyahat-asistani-enbo/) **[OLDER]**
- In Aug 2025 Enuygun launched a **travel MCP server** (mcp.enuygun.com) exposing flight, hotel, bus-ticket and car-rental search and booking to MCP-capable models such as Claude. — [Webrazzi, 8 Aug 2025](https://webrazzi.com/2025/08/08/yapay-zeka-destekli-seyahat-deneyimi-enuygun-com-un-seyahat-mcp-sunucusu/)

**Turkish AI planners and route apps (2025–26 newcomers)**
- **Routevia**, by indie developer Yunus Güneş (Tabserve), on iOS and Android, "free to start":
  - turns a must-see list into an AI day-by-day itinerary across Türkiye;
  - optimizes routes with travel times;
  - offers 80+ regional guides and covers all 81 provinces with "thousands of curated places".
  - Product Hunt traction is minimal (0 upvotes, 1 comment).
  - Restaurants, hotels, budget and re-planning are **not mentioned**.

  — [Hunted.space / Product Hunt mirror](https://hunted.space/product/routevia); [Tabserve indie page](https://indiepa.ge/tabserve)
- **Optiviser Trip**, by Optiviser Yapay Zeka Arge A.Ş.:
  - AI plans from destination, dates, budget and party size;
  - daily routes grouped on a map; restaurant and hotel suggestions; weather- and interest-aware plans;
  - social route sharing, and a **business panel for hotels and restaurants to add their own info**;
  - **contains ads**; no ratings yet; v1.0.11 around Jan 2026.

  — [App Store: Optiviser Trip](https://apps.apple.com/mx/app/optiviser-trip/id6753893275)
- **Tatil Planlama AI** (PIXS Yazılım) is another Turkish AI holiday-planner listing. — [App Store](https://apps.apple.com/hn/app/tatil-planlama-ai/id6751206609) (features not examined)
- **SilaYolu** (iOS, first released 5 Jun 2026) is aimed at gurbetçi driving to Türkiye via the Balkans:
  - border wait estimates, route comparison, fuel/toll/vignette cost estimates, EUR/USD/CHF→TRY rates;
  - community road reports and an AI Q&A assistant;
  - <1,000 downloads and 0 ratings.

  — [MWM listing](https://mwm.ai/apps/silayolu/6769356177)
- **Yandex Trip AI Agent** (Yandex AI app, Türkiye): a Yandex product manager's LinkedIn post says it plans trips with flights, hotels, activities, **live traffic with multiple stops**, restaurant recommendations, **budget estimations** and richer visual answers. There is no official press release; this rests on a single LinkedIn post. — [LinkedIn](https://tr.linkedin.com/in/kurtb) (low confidence)

**Local community knowledge**
- In an Ekşi Sözlük entry, a user recommends Wikiloc for nature routes, having walked the Likya Yolu solo on a downloaded track; the complaint is Android battery drain. — [Ekşi Sözlük entry](https://eksisozluk.com/entry/75759752)

### Inferences
- GoTürkiye has rich, official, 81-province content but behaves as a brochure. The app appears unmaintained since mid-2024 and unrated, and there is no evidence of maps, live data or adaptive planning. Its content (themes, routes, provincial highlights) is a useful **seed dataset to link to**, not a competitor to fear.
- The Müzekart economics (200 TL a year for 350+ sites) are a concrete budget feature no global app models. Examples: "this route has 7 Müzekart sites: buy the card, it saves X TL", and flagging excluded sites such as Topkapı Harem.
- Enuygun's MCP server means an LLM-based app could pull Turkish bus, flight, hotel and car-rental availability. That is a domestic-transport layer that global planners lack (intercity bus is central to Turkish travel).
- Real direct competitors are tiny and unproven: Routevia, Optiviser and Yandex's agent. Optiviser has ads and a pay-to-list business panel, so a no-ads, no-sponsored-listing app is a credible trust differentiator. Yandex is the one with resources and Turkish-language AI; watch it closely.

### Gaps
- No sources found on AI or itinerary features of **Etstur, Tatilbudur, Jolly or Obilet** in 2025–26. Their status as plain booking OTAs is assumed, not verified.
- No user criticism of GoTürkiye (Ekşi, app reviews) was found. The App Store shows too few ratings, and Google Play was not checked.
- "Gezimanya", "Gezgin", Yemek.com guides, "Lezzet haritası", Culinary Backstreets and Istanbul Eats were **not researched** (tool budget); no sourced facts.
- No complaints about the Türkiye'nin Müzeleri app were found in search.
- No Turkish AI trip-planner startups with funding or press coverage (Webrazzi, Egirisim) were found. Webrazzi's AI-planner coverage was of a foreign startup, Wanderboat.

---

## 5. Budget/expense apps for travel (TravelSpend, Trail Wallet, Splitwise, Tricount): features worth copying

### Takeaway
The pattern to copy is TravelSpend: daily budget versus actual, any-currency entry with auto-conversion to a home currency (offline using the last cached rate), split and settle-up, multi-day spreading of an expense, and CSV export. Splitwise and Tricount own group splitting. None of them connects to the itinerary.

### Cited Findings
- **TravelSpend:**
  - set a daily budget and log expenses in any currency, auto-converted;
  - dashboard compares daily average spend against budget in real time;
  - works offline and syncs later, converting with the last-fetched rate;
  - shows totals in both entered and home currency;
  - split bills, track balances and settle debts;
  - photo attachments, spreading an expense over multiple days, cross-device sync, charts, CSV export.

  — [Adam & Linds review](https://adamandlinds.com/travelspend-review-budget-tracking-full-time-travel/); [Change Group](https://uk.changegroup.com/travel-blog/travel-tips/apps-manage-travel-budget)
- TravelSpend pricing: a free limited tier, ~$5/month or a ~$60 one-time purchase. — [AlternativeTo](https://alternativeto.net/software/travelspend/about) (may be outdated)
- **Trail Wallet:** daily budget, organized by trip or month; the free tier is limited to 25 items. Sources **conflict** on multi-currency support (one says yes; a comparison table says no and iPhone-only). — [Matador Network](https://matadornetwork.com/read/9-best-budgeting-apps-travelers/); [Too Many Adapters](https://toomanyadapters.com/apps-manage-finances-travel/)
- **Splitwise:** split by percentage or shares, multi-currency, a separate group per trip, offline mode. No daily-budget feature was found. — [The Points Guy](https://thepointsguy.com/news/apps-track-travel-expense)
- **Tricount:** shared expenses, automatic currency conversion, offline use, limit of 30 people per tricount. — [MoneyVox (FR)](https://www.moneyvox.fr/votre-argent/actualites/101339/paiement-les-5-meilleures-applications-pour-faire-vos-comptes-entre-amis)
- Wanderlog includes expense tools, but some features are paywalled (section 2). — [Endless Travel Plans, Jul 2026](https://www.endlesstravelplans.com/guides/planning-tools/wanderlog-review)

### Inferences
- **Table stakes to copy:**
  - daily budget versus actual;
  - multi-currency with cached-rate offline conversion (TRY for locals; EUR/USD/GBP to TRY for foreigners);
  - categories;
  - multi-day spreading, e.g. a hotel cost spread across nights;
  - group split and settle;
  - CSV export.
- **Differentiators no budget app has:**
  - budget-aware planning: each suggestion carries an expected price band, and remaining budget feeds the next day's suggestions (switch to an esnaf lokantası if over budget);
  - Turkey-specific cost items such as Müzekart, HGS/OGS tolls, fuel, intercity bus versus flight, and çay prices;
  - inflation-aware price freshness: show when a price was last observed, since TRY prices move quickly.

### Gaps
- No current (2026) pricing or feature verification from official App Store listings for these four apps.
- No source on whether any of them supports Turkish UI or TRY-specific features.

---

## 6. Recurring user complaints and traveler wishes (app stores, Reddit, Ekşi Sözlük, forums)

### Takeaway
The evidence I could collect clusters into four complaint types:
1. Trust in place data (fake or paid reviews, tourist traps, closed places, wrong hours).
2. Monetization friction (offline and group features behind subscriptions, surprise renewals).
3. Bugs and sync in long itineraries.
4. AI plans that look good but fail on reality.

Direct "I wish an app did X" Reddit threads were not retrievable through search.

### Cited Findings
- Trust: an Istanbul visitor distrusts Google ratings that seem inflated relative to Michelin places and asks for a trustworthy Turkish review source. — [r/istanbul, Sep 2024](https://axebps-redlib.hf.space/r/istanbul/s/D8rThSu7Fg) **[OLDER]**
- Monetization: Wanderlog's yearly-only pricing, offline and attachments behind the paywall, an unexpected charge, auto-renew without warning, and Premium not shared with the group. — [Trustpilot: Wanderlog](https://trustpilot.com/review/wanderlog.com)
- Offline gating on Tripomatic Premium. — [App Store: Tripomatic](https://apps.apple.com/app/tripomatic/id519058033)
- Reliability: Wanderlog sync and mobile bugs. — [Trustpilot: Wanderlog](https://trustpilot.com/review/wanderlog.com). Layla failed to produce usable plans for some reviewers. — [Trustpilot: Layla](https://ca.trustpilot.com/review/layla.ai)
- AI reality failures: closed venues (24%), out-of-hours visits (~50%), fictional places and backtracking. — [Travolution, 2025](https://travolution.com/news/marketing/survey-finds-chatgpt-itineraries-to-be-riddled-with-inaccuracies)
- Homogenization risk: AI may push everyone onto the same popular routes. — [Euronews TR, Apr 2026](https://tr.euronews.com/2026/04/11/yapay-zeka-turizmi-nasil-etkiledi-seyahatleri-chatgpt-planladi)
- Tourist-trap anxiety in Istanbul (shoe-shine scam, carpet shops, overpriced cruises). — [Tabiji, 2026](https://tabiji.ai/scams/istanbul/); [Outlook Traveller](https://www.outlooktraveller.com/destinations/international/tourist-traps-to-avoid-in-t%C3%BCrkiye-a-first-timers-guide)
- Mindtrip's restaurant picks lean touristy. — [Lindy, 2026](https://www.lindy.ai/blog/trip-planner-app) (vendor blog)
- Battery drain from GPS track apps (Wikiloc, Android). — [Ekşi Sözlük](https://eksisozluk.com/entry/75759752)

### Inferences
- The "wish list" implied by the complaints:
  - "Tell me where locals actually eat or drink tea here, not the tourist-trap version."
  - "Don't send me to a closed place."
  - "If I'm late or skip something, fix the rest of my day."
  - "Don't paywall offline."
  - "Keep my group in sync for free."
  - "Tell me if I'm over budget today."
- Battery and data are real constraints for an all-day guide app. A morning-briefing model (plan pushed once, offline-cached, re-plan only on trigger) fits this better than continuous GPS tracking.

### Gaps
- No direct Reddit (r/travel, r/Turkey, r/istanbul) wish-list threads about trip apps were retrieved; the search engine returned mirrors and marketing pages instead.
- No Ekşi Sözlük başlık specifically criticizing GoTürkiye, Wanderlog or AI planners was found.
- App Store and Google Play review mining for Turkish-language reviews was not done (tool budget).

---

## 7. Differentiating features vs. table stakes (synthesis)

### Takeaway
Table stakes in 2026 are an AI first draft, map plus day-by-day list, collaboration, offline access, booking links and expense logging. The defensible gap for a Turkey-only, non-commercial app is a **trusted local data layer**, fused with an **in-trip adaptive "morning guide" that re-plans on skip, delay or overspend**. No reviewed competitor (Google, Yandex, Mindtrip, Wanderlog, GoTürkiye, Routevia, Optiviser) was shown to combine these.

### Cited Findings (evidence base for the classification)
- An AI first draft is now everywhere: Ask Maps day-by-day road-trip itineraries ([PCWorld](https://www.pcworld.com/article/3086987/gemini-just-became-your-new-google-maps-buddy.html)), Mindtrip ([Sabre](https://investors.sabre.com/node/19876)), Layla ([Travolution](https://www.travolution.com/news/travel-sectors/intermediaries/expedia-group-acquires-layla-to-accelerate-ai-trip-planning/)) and Routevia for Türkiye ([Hunted.space](https://hunted.space/product/routevia)).
- Chat-based place discovery in Turkish already exists: Yandex AI in Haritalar and Navi, Aug 2026. — [Teknoblog](https://www.teknoblog.com/yandex-haritalar-yapay-zeka-ile-rota-hazirliyor/)
- Multi-stop, budget-estimating trip agents for Türkiye are emerging: Yandex Trip AI Agent. — [LinkedIn](https://tr.linkedin.com/in/kurtb) (low confidence)
- In-route AI prompts (best time to leave, scenic route) are experimental at Google. — [Ubergizmo, Jul 2026](https://www.ubergizmo.com/2026/07/google-maps-gets-ask-maps-gemini-ai-to-plan-your-travels/)
- Expert-curated dining covers only 4 Michelin and 11 Gault&Millau provinces. — [Michelin](https://guide.michelin.com/gb/en/article/michelin-guide-ceremony/the-michelin-guide-turkiye-reveals-its-2026-restaurant-selection); [Euronews TR](https://tr.euronews.com/kultur/2025/12/12/turk-mutfagi-dunya-sahnesinde-gaultmillau-2026-odulleri-aciklandi)
- Offline access is commonly paywalled. — [Endless Travel Plans](https://www.endlesstravelplans.com/guides/planning-tools/wanderlog-review); [Tripomatic](https://apps.apple.com/app/tripomatic/id519058033)
- Turkish domestic transport inventory (bus, flight, hotel, car rental) is accessible to LLM agents through Enuygun's MCP server. — [Webrazzi, Aug 2025](https://webrazzi.com/2025/08/08/yapay-zeka-destekli-seyahat-deneyimi-enuygun-com-un-seyahat-mcp-sunucusu/)

### Inferences
**Table stakes (must have, they win nothing on their own):**
- AI-generated multi-day itinerary from a prompt, editable by drag and drop.
- Map view with day-colored routes and travel times between stops.
- Accommodation, restaurant and activity suggestions with links.
- Offline access to the plan and maps; free here, which already beats Wanderlog and Tripomatic.
- Sharing and collaborative editing for a group, free for all members.
- Expense logging with categories, multi-currency and split.
- Turkish and English UI.

**Differentiators (where a Turkey-specific app can beat everyone):**
1. **Adaptive in-trip re-planning engine.** On "skip", "late" or "closed", rebuild the remainder of the day: nearest open alternative of the same category, within remaining budget and time, with travel time re-computed. Only experimental or partial analogues exist (Google in-route prompts, Mindtrip flight changes).
2. **"Sabah rehberi" (morning brief) mode.** One push per day with today's stay, eat, tea and shop items, plus weather, opening-hour warnings and a budget-left figure. This is a new interaction model; no competitor was found doing it.
3. **Turkey-native taxonomy.** Çay bahçesi/ocağı, kahvaltı salonu, esnaf lokantası, ocakbaşı, meyhane, pazar/semt pazarı (by weekday), kapalı çarşı/arasta, yöresel ürün satıcıları, kervansaray and han stops on intercity drives, dinlenme tesisleri. Global taxonomies do not model these well. This is an inference; Google category coverage was not checked.
4. **Trust and anti-tourist-trap scoring.** Weight Michelin/Bib, Gault&Millau, local-press and Ekşi/Reddit mentions. Penalize review-velocity spikes and hotspot-adjacent places with anomalous ratings. Surface known scam patterns per district. Be transparent: "why this place".
5. **Turkey cost model.** Müzekart break-even, excluded sites, HGS/OGS tolls, fuel cost per route, intercity bus versus flight via the Enuygun MCP or similar, and price-freshness stamps for TRY inflation.
6. **Calendar and context awareness.** Museum closing days, Ramazan and bayram hours and traffic, pazar weekdays, seasonal access (yayla roads, Kapadokya balloon cancellations). An inference: all are frequent sources of plan failure, but none was verified as a gap in competitors.
7. **No ads, no sponsored listings, no booking commissions.** A trust position that neither OTAs nor Optiviser (ads plus business panel) can claim.

**Biggest competitive risks:**
- Google rolling Ask Maps trip planning and in-route re-planning prompts out to Türkiye in Turkish.
- Yandex's Turkish-language AI in Haritalar and Navi plus its Trip AI Agent.
- Generalist LLM apps with OTA connectors (ChatGPT plus Booking, Expedia, Tripadvisor; Claude plus the Enuygun MCP).

### Gaps
- No feature-by-feature verification of Google Maps' Turkish category taxonomy (çay bahçesi etc.). Differentiator 3 is an inference.
- No competitor was confirmed to handle Ramazan, bayram or museum closing days. Differentiator 6 is unverified either way.
- Data-access costs and terms (Google Places API pricing, Yandex API, OSM/Overpass) for a no-revenue developer were not researched here. They matter for feasibility.
