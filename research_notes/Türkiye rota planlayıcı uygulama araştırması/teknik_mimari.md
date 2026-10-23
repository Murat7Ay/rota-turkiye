# Technical architecture for an AI-powered, Turkey-specific multi-day trip planner (state as of 23 Oct 2026)

Scope: solo Turkish developer (with Claude Code), free, ad-free, non-commercial, personal use first and public later. Every claim below has an inline source; anything marked **[inference]** is my own reasoning from the cited facts, and **[older]** marks pre-2025 information that newer work may have superseded. Prices are list prices seen on 22–23 Oct 2026 unless noted.

---

## 1. Itinerary generation: pure LLM vs LLM + constraint solver hybrid

### Takeaway
The research from 2024 to 2026 points one way. LLMs on their own are unreliable at meeting hard constraints such as opening hours, travel times and budget. Systems where the LLM interprets the request and a solver or verifier enforces the constraints reach roughly 90% or higher success on the standard benchmarks. Google's production "AI trip ideas" uses this split: Gemini drafts the plan, then DP and local-search optimization repairs it. Build hybrid from day one: the LLM proposes, a deterministic solver decides, and the LLM explains the result.

### Cited Findings
- **[older, Feb 2024]** TravelPlanner (Xie et al., ICML 2024 Spotlight) has 1,225 planning intents and about 4M data records. GPT-4 reached a **0.6% success rate**. The failure modes were going off task, using the wrong tool, and losing track of multiple constraints — [arXiv 2402.01622](https://arxiv.org/abs/2402.01622)
- **[older, v3 Jan 2025]** Hao, Chen, Zhang, Fan: the LLM formalizes the trip request as a constraint-satisfaction problem and a sound-and-complete satisfiability solver solves it. Result: **93.9% success on TravelPlanner**, against about 10% for o1-preview given all the needed information. For unsatisfiable queries it finds the unsat core and suggests changes, fixing 81.6% and 91.7% of them on two datasets. The authors say LLMs struggle to produce correct multi-constraint plans directly "even with self-verification and self-critique" — [arXiv 2404.11891](https://arxiv.org/abs/2404.11891)
- **[older, 2024]** LLM-Modulo (Kambhampati group). On TravelPlanner, CoT, ReAct and Reflexion with GPT-3.5-Turbo scored 0%, 0.6% and 0%. Adding binary "critics" with back-prompts gave GPT-4-Turbo a 4.6× improvement and lifted GPT-3.5 from 0% to 5%. The position paper says autoregressive LLMs cannot plan or self-verify by themselves — [arXiv 2405.20625](https://arxiv.org/pdf/2405.20625); [arXiv 2402.01817](https://arxiv.org/html/2402.01817v2). A follow-up compound-architecture paper reports GPT-4o going from 8.3% to 23.89% and Claude-3.5-Sonnet from 4.4% to 25% — [arXiv 2411.14484](https://arxiv.org/html/2411.14484v1). Caveat: these results come from the authors' own group on the validation set, and I found no independent replication.
- **[older, 2024]** TRIP-PAL: the LLM translates travel information into a structure that an automated planner uses, which "guarantee[s] constraint satisfaction" and optimizes utility — [arXiv 2406.10196](https://ar5iv.labs.arxiv.org/html/2406.10196)
- **[older, EMNLP 2024 Industry]** ITINERA/ItiNera has five LLM-assisted modules: database construction, request decomposition, preference-aware retrieval, **cluster-aware spatial optimization**, and itinerary generation. Its motivation is that plain LLM itineraries tend to be "circuitous" and impractical. The code is public at github.com/YihongT/ITINERA — [alphaxiv 2402.07204](https://alphaxiv.org/abs/2402.07204); [ACL Anthology](https://preview.aclanthology.org/fix-8040/2024.emnlp-industry.104)
- **ACL 2025**, TripCraft (Chaudhuri et al.): a benchmark built on real data, with transit schedules, events, attractions and personas. It criticises TravelPlanner's semi-synthetic geography, for example New York accommodations assigned across 312 cities. A "parameter-informed" setting raised the temporal meal score from 61% to 80% on 7-day trips — [arXiv 2502.20508](https://arxiv.org/pdf/2502.20508)
- **ACL 2025**, Personal Travel Solver: an LLM combined with numerical solvers. It introduces RealTravel, which adds real reviews and POI metadata so implicit preferences are covered — [ACL 2025.acl-long.1339](https://aclanthology.org/2025.acl-long.1339.pdf)
- **Dec 2025 (WWW 2026)**, TriFlow: a retrieval → planning ("rule-LLM collaboration") → governance pipeline. Final pass rate **91.1% on TravelPlanner and 97% on TripTailor**, with "over 10× runtime efficiency" over the previous SOTA. It states that LLM agents "struggle with constraint satisfaction, tool coordination, and efficiency" — [arXiv 2512.11271](https://arxiv.org/abs/2512.11271)
- **Jan 2026**, TourPlanner uses consensus plus constraint-gated RL. Its related work credits solver integration (Hao et al.) with "substantially improving success rates" — [arXiv 2601.04698](https://arxiv.org/html/2601.04698v1)
- **Jul 2026**, TREK, an evaluation kit, certifies whether a plan is executable: constraint correctness, entity grounding, spatio-temporal reachability, and budget validity. It criticises benchmarks that grade with "soft or LLM-judged rubrics" — [alphaxiv 2607.26977](https://www.alphaxiv.org/abs/2607.26977)
- Other 2025–26 benchmarks: Flex-TravelPlanner (constraints introduced over several turns, prioritized competing constraints) [arXiv 2506.04649](https://arxiv.org/abs/2506.04649); DeepPlanning (verifiable constraints) [arXiv 2601.18137](https://arxiv.org/pdf/2601.18137); GroupTravelBench (multi-person) [arXiv 2605.25200](https://arxiv.org/pdf/2605.25200); COMPASS (constrained optimization in agents) [arXiv 2510.07043](https://arxiv.org/pdf/2510.07043); TP-RAG [arXiv 2504.08694](https://arxiv.org/pdf/2504.08694); DeepTravel (agentic RL) [arXiv 2509.21842](https://arxiv.org/pdf/2509.21842)
- **Production evidence (Google, June 2025).** In Google's "AI trip ideas in Search", a Gemini model proposes day-by-day activities with durations and importance. The plan is grounded against current opening hours and travel times, and search backends fetch substitute activities. Stage 1 runs an exhaustive DP per day over activity subsets, scored by similarity to the LLM plan and feasibility; an infeasible schedule scores 0. Stage 2 is a cross-day weighted set-packing problem (NP-complete), solved by local search that swaps activities between pairs of days. Google publishes no quantitative evaluation, only examples, such as regrouping a San Francisco day that crossed the city — [Google Research blog](https://research.google/blog/optimizing-llm-based-trip-planning/)

### Inferences
- **[inference]** The recommended pattern for this app, "LLM proposes, solver disposes, LLM explains":
  1. The LLM parses free text into a typed constraint object using structured outputs: dates, start and end cities, pace, interests, budget envelope, must-sees, dietary needs, and so on.
  2. Deterministic retrieval in PostGIS and pgvector produces about 50–200 candidates per day region.
  3. Optionally, the LLM scores the candidates for this persona, producing a utility per POI.
  4. The solver (OR-Tools or VROOM, see §2) builds feasible days.
  5. Deterministic critics, as in LLM-Modulo, re-check hours, travel time, budget and meal slots.
  6. The LLM writes the Turkish narrative and the "why".

  The LLM never outputs times or orderings that go to the user without validation.
- **[inference]** A full SAT/SMT formalization in the Hao et al. style is overkill for a solo developer. A routing solver with optional nodes covers the travel-specific constraints with far less engineering. Copy Google's two-level structure (per-day exact or near-exact solving, cross-day swaps) for multi-day trips.
- **[inference]** The benchmark numbers come from models from 2024 and early 2025. Frontier models in Oct 2026 are likely better at pure-LLM planning, but none of the 2026 papers I found reports pure-LLM success near solver-backed levels. Keep the solver.

### Gaps
- I found no 2026 head-to-head of the current frontier models (Claude 5.x, Gemini 3.8/4, GPT-5.5) on TravelPlanner without solvers.
- I did not open TriFlow's full paper to see exactly which parts are rules and which are LLM.
- None of the benchmarks are Turkey-specific or Turkish-language.

---

## 2. Optimization formulation: OP / TSPTW / VRPTW; OR-Tools vs Timefold vs VROOM

### Takeaway
Model each day as a single-vehicle **prize-collecting TSP with time windows**, which is an orienteering problem with time windows. The start is this morning's hotel or the current location and the end is tonight's hotel. POIs are optional nodes whose skip-penalty equals their utility. Meals are "pick one of N" groups with mealtime windows. Use **OR-Tools** for full modelling power, or **VROOM** for the fastest integration with a JSON API and OSRM. Avoid Timefold for a TypeScript/Python solo stack.

### Cited Findings
- OR-Tools makes a visit optional with `routing.AddDisjunction([node], penalty)`. The solver minimizes cost plus the penalties of dropped nodes. If penalties exceed the sum of distances, only the minimum needed nodes are dropped; smaller penalties let it drop more. The example uses `PATH_CHEAPEST_ARC` with `GUIDED_LOCAL_SEARCH` and a 1 s limit — [OR-Tools: penalties](https://developers.google.com/optimization/routing/penalties)
- OR-Tools time windows come from a "Time" dimension with positive **slack** (waiting time allowed) and a horizon cap. `CumulVar(index).SetRange(start,end)` sets each node's window, the start node takes the depot window, and `AddVariableMinimizedByFinalizer` sets start and end times. Service time is not built into the example and must be folded into the transit callback — [OR-Tools: VRPTW](https://developers.google.com/optimization/routing/vrptw)
- VROOM (C++20) is built for "good solutions within a small computing time". It supports TSP, CVRP, VRPTW, multi-depot heterogeneous VRPTW and PDPTW. It was originally built on OSRM for table and route computations, can take custom matrices, and has a Python wrapper, pyvroom — [VROOM GitHub](https://github.com/vroom-project/vroom); [pyvroom on PyPI](https://pypi.org/project/pyvroom)
- VROOM API details. Jobs take `service`, `setup`, `priority` (0–100), `time_windows` and `skills`. Vehicles take `start` and `end` (omitting `end` ends the route at the last task), `time_window`, `breaks` (each with time windows and a service duration), `max_travel_time`, `max_tasks` and `speed_factor`. Jobs that cannot be served go to an `unassigned` array, and higher priority is favoured when not everything fits. Custom `durations`/`distances`/`costs` matrices are accepted per profile — [VROOM API.md](https://github.com/VROOM-Project/vroom/blob/master/docs/API.md)
- Timefold Solver Community Edition is Apache-2.0 and "will always be free". Its main languages are Java and Kotlin, with Python also listed — [Timefold docs](https://docs.timefold.ai/timefold-solver/latest/introduction/introduction); [GitHub](https://github.com/TimefoldAI/timefold-solver). The separate Python repo was **archived on 6 Oct 2025**, the old `timefold-solver` PyPI package was yanked in favour of `timefold`, and that package is labelled pre-release — [PyPI timefold](https://pypi.org/project/timefold/); [PyPI timefold-solver](https://pypi.org/project/timefold-solver)
- Google's production per-day solver uses exhaustive search with DP over small activity subsets, which works because daily activity counts are small — [Google Research](https://research.google/blog/optimizing-llm-based-trip-planning/)
- ITINERA orders POIs with "cluster-aware spatial optimization", grouping by area first — [alphaxiv 2402.07204](https://alphaxiv.org/abs/2402.07204)
- A solo-dev case study used Google Distance Matrix with OR-Tools for a personal route optimizer — [Medium](https://medium.com/@van.evanfebrianto/building-a-personal-travel-route-optimizer-a-technical-odyssey-e46b5b49a1fa)

### Inferences
- **[inference] Concrete OR-Tools model for one day:**
  - **Nodes:** 0 is the start (hotel or current GPS) and 1 is the end (tonight's hotel; for road-trip days in Turkey this differs from the start). The other nodes are candidate POIs, restaurants, çay/kahve stops and shops.
  - **Cost:** travel time plus a small per-km cost. The transit callback is travel time(i→j) plus the service duration at i, where service durations are typical visit lengths by category, for example museum 90 min and çay ocağı 20 min.
  - **Optional POIs:** `AddDisjunction([poi], penalty = utility × W)`, where utility comes from LLM or persona scoring and must-sees get a huge penalty.
  - **Meals:** `AddDisjunction([r1..rk], penalty_big, max_cardinality=1)` with each restaurant's `CumulVar` bounded to the lunch window (12:00–14:30) or dinner window (19:00–22:00), intersected with its opening hours. Breakfast is assumed at the hotel unless specified.
  - **Time dimension:** slack lets the traveller wait for opening times, and the horizon is the day window (for example 08:30–22:30).
  - **Fatigue:** a second dimension, "effort", accumulates walking minutes and visit intensity, with a soft upper bound (`SetCumulVarSoftUpperBound`) and a hard cap for the user's pace. Alternatively, a mid-afternoon rest as a vehicle break.
  - **Preferences** enter only through penalties and utilities, so the solver stays generic.
- **[inference] VROOM mapping:** must-sees get priority 100 and nice-to-haves 1–99. The vehicle runs from hotel to hotel with a day time window, and `breaks` model lunch, dinner and tea as time-windowed rests. Limitation: VROOM has no "exactly one of these restaurants" group in the documented API. Pre-select the 1–2 best restaurants near the expected lunch area, or run a second pass. VROOM is trivially fast and easy to self-host next to OSRM, so it is a good v1. Move to OR-Tools when you need groups, soft bounds or the fatigue dimension.
- **[inference] Multi-day:**
  1. Fix the overnight cities first (an LLM proposal checked against drive-time limits per day, such as ≤5 h of driving).
  2. Cluster candidates into days by geography, as ITINERA does.
  3. Solve each day.
  4. Run a cross-day swap local search as Google does: move a POI to another day if the total utility rises.
  5. Solve times are milliseconds to seconds, so everything can run synchronously in an API call.
- **[inference]** Timefold is technically strong but its centre of gravity is Java, and the Python package is pre-release. That makes it a poor fit for a TS-first solo developer.

### Gaps
- I did not verify OR-Tools' current license or version in this pass. It has historically been Apache-2.0.
- I found no published benchmark of OR-Tools against VROOM on small 30–60-node prize-collecting instances.
- I did not confirm whether VROOM supports alternative or exclusive job groups.

---

## 3. Real-time replanning: event-driven re-optimization, geofencing, push

### Takeaway
Treat replanning as **plan repair**, not regeneration. Re-run the same day solver from the current position and time. Lock visited stops, and give a bonus for keeping already-accepted stops so the plan stays stable. Return 2–3 alternatives that a cheap LLM explains. The 2026 research finds local or hierarchical repair keeps more of the plan, at far lower cost, than LLM-plus-solver full replanning, which wins only on compound disruptions. On mobile, use geofences around only the next few stops, because iOS caps an app at 20 monitored regions.

### Cited Findings
- **Oct 2025, ACL Findings 2026: TripTide** (built on TripCraft) adds disruptions such as flight cancellations, weather closures and overbooked attractions, with severity and traveler tolerance. LLMs keep sequential and semantic consistency well. Spatial deviation is larger in short itineraries, and **ability to handle disruptions declines as plan length increases** — [arXiv 2510.21329](https://arxiv.org/abs/2510.21329)
- **Sep 2026: "Replan, Repair, or Edit?"** compares three revision approaches on TREK-derived sets: 500 single-disruption cases and 200 compound-disruption cases. LLM-Z3 full replanning with Gemini had the highest success on compound disruptions. IPyHOPPER, a classical hierarchical repair with **no LLM inference**, nearly matched it on single disruptions and preserved substantially more of the original plan. iTIMO local edit used substantially more tokens. The authors argue that success rate alone hides plan preservation and cost — [arXiv 2609.19654](https://arxiv.org/abs/2609.19654)
- **Expo geofencing** uses `Location.startGeofencingAsync(task, regions)`; calling it again with new regions replaces them. Android allows up to **100** geofences per app and iOS monitors at most **20** regions. Background use needs "Always" permission on iOS, and on Android needs background permission plus Play Store review. iOS relaunches a terminated app on a geofence event; **Android does not**. Expo Go does not support background location, so a development build is required — [Expo Location docs](https://docs.expo.dev/versions/latest/sdk/location/)
- Wanderlog's public "optimize route" is a Pro (paid) feature. I found no engineering write-up of its algorithm — [Wanderlog travel maps](https://wanderlog.com/travel-maps); [iMore](https://www.imore.com/apps/travel-apps/wanderlog-iphone-travel-app-trip-planning)
- Google's trip-ideas optimizer already pulls substitute activities in parallel so it can replace infeasible ones — [Google Research](https://research.google/blog/optimizing-llm-based-trip-planning/)
- KVKK announcement (Jan 2026): mobile push consent must be separated by notification type, for example operational versus campaign — [Alomaliye summary of KVKK announcement](https://www.alomaliye.com/2026/01/14/mobil-uygulamalarda-tek-tik-riza-donemi-bitiyor-bildirim-amaclari-ayrilacak/amp/)
- Weather triggers: the Open-Meteo free API is for non-commercial use only, under 10,000 calls/day, 5,000/hour and 600/minute. Data is CC BY 4.0, the code is AGPLv3 and can be self-hosted — [Open-Meteo terms](https://open-meteo.com/en/terms); [open-meteo.com](https://open-meteo.com/)

### Inferences
- **[inference] Event model.** Represent the plan as a list of stops with states: planned, en route, arrived, done, skipped, missed. Each trigger produces an event:
  - **Explicit skip:** the user swipes "atla".
  - **Late:** now plus the ETA to the next stop is later than its latest start, computed on device every N minutes while the app is in use, and also on a geofence exit from the current stop.
  - **Closed:** a user report, or an `opening_hours` re-evaluation for today's date, which matters on bayram days.
  - **Weather:** an hourly Open-Meteo forecast for the day's bbox, with precipitation probability above a threshold during outdoor stops.
  - **Missed meal window.**
- **[inference] Repair algorithm.** Re-solve the rest of the day:
  - Start node is the current GPS position at the current time; the end is the hotel.
  - Visited or locked stops are removed.
  - Remaining planned stops get a **stability bonus**, a higher drop penalty than equally good new candidates.
  - New candidates come from a precomputed "alternatives pool" per day: same category, indoor if it is raining, open now, within X km.
  - Return the top 2–3 distinct solutions, for example "drop Y" versus "swap Y for Z". The LLM, using the cheapest model, writes a 2-sentence Turkish explanation for each. The user accepts with one tap.
- **[inference] Offline repair.** When the phone has no signal, which is common on Karadeniz and Doğu roads, run a simple on-device insertion/removal heuristic. It uses the day's precomputed duration matrix (about 60×60 = 3,600 numbers), cached in SQLite with the trip pack. No LLM is needed, and the explanation is template-based. Re-optimize on the server when the connection returns.
- **[inference] Geofences.** Keep a rolling window: register the next 5–10 stops plus the hotel, re-registering on each enter or exit. That stays under iOS's 20-region limit. Android does not relaunch a killed app, so also schedule local notifications at expected stop times. Do not rely only on geofences.
- **[inference] Push.** The morning briefing and nudges like "you are running late" can be **local notifications** scheduled on device from the cached plan. That avoids a push server and works offline. Use server push (Expo push service, or FCM/APNs directly) only for server-originated events, such as a place reported closed.
- **[inference] Weather data.** Open-Meteo's free tier covers the personal phase, and 10k calls/day is enough for about 1,000 MAU if each trip-day fetches once or twice. A public app arguably stays "non-commercial" under its terms, but confirm with Open-Meteo. Self-hosting is the escape hatch.

### Gaps
- I found no public engineering details of how Google Maps or Wanderlog trigger re-routing or replanning on the itinerary level.
- I did not verify Expo push-service pricing or rate limits in this pass.
- I did not check whether the MGM (Turkish State Meteorological Service) offers an open API.

---

## 4. Routing engines for Turkey: OSRM vs Valhalla vs GraphHopper vs ORS vs Google

### Takeaway
Turkey is a medium-size OSM extract of about 621 MB PBF. Self-hosting **OSRM**, with car and foot profiles and the `/table` matrix, or **Valhalla**, with flexible per-request costing, on one small VPS is cheap and gives unlimited matrices. A day plan needs matrices and the solver calls them repeatedly, so this matters. Google Routes is fine for a prototype on the free monthly allowance, but its matrix costs scale linearly. Openrouteservice's free hosted tier allows only 500 matrix calls per day.

### Cited Findings
- The Geofabrik Turkey extract is `turkey-latest.osm.pbf`, **621 MB**, with data up to 2026-10-22, updated daily — [Geofabrik Turkey](https://download.geofabrik.de/europe/turkey.html)
- **Comparison from a 2026 blog** (secondary, unverified numbers):

  | | OSRM | GraphHopper | Valhalla |
  |---|---|---|---|
  | Matrix | `/table` | yes | yes |
  | Isochrones | no | yes | yes |
  | License | BSD-2 | Apache-2.0 | Apache-2.0 |
  | Profiles | Lua | Java code | JSON costing, adjustable per request |
  | Full planet RAM / disk | ~55 GB / ~50 GB | ~40–60 GB / ~40 GB | not stated / ~100 GB |
  | Docker | official GHCR image | community image | official `valhalla-scripted` image, can auto-download tiles |

  None has built-in traffic. OSRM has the "smallest memory footprint for a given region size"; choose GraphHopper for isochrones or elevation and Valhalla for multimodal or fine-grained costing — [pistack.xyz 2026 guide](https://www.pistack.xyz/posts/2026-04-25-graphhopper-vs-osrm-vs-valhalla-self-hosted-routing-engines-guide-2026/)
- **Conflict on GraphHopper matrix:** Geofabrik's hosted-routing comparison lists matrix queries for OSRM but **not** for GraphHopper, which suggests the open-source GraphHopper may not include the matrix — [Geofabrik routing](https://geofabrik.de/data/routing.html); compare [pistack.xyz](https://www.pistack.xyz/posts/2026-04-25-graphhopper-vs-osrm-vs-valhalla-self-hosted-routing-engines-guide-2026/)
- Another 2026 guide calls OSRM "traditionally the king" for distance-matrix speed. It favours Valhalla for custom costing, multimodal routing and isochrones, and OSRM for fixed profiles and high queries per second — [sumguy.com](https://sumguy.com/osrm-vs-valhalla-vs-graphhopper/)
- **Openrouteservice free Standard plan:** Directions 2,000/day (40/min), **Matrix 500/day** (40/min), Isochrones 500/day, Optimization 500/day. The Collaborative tier, for non-profit and academic use, raises Directions to 10,000/day and Matrix to 2,500/day — [ORS plans](https://openrouteservice.org/plans/)
- **Google Maps Platform, per 1,000 events in the first tier.** Compute Routes: Essentials $5 (10,000 free/month), Pro $10 (5,000 free), Enterprise $15 (1,000 free). **Compute Route Matrix** has the same prices and free caps. Places Text Search Pro is $32 (5,000 free) and Place Details Essentials $5 (10,000 free). Dynamic Maps cost $7 (10,000 free) and Geocoding $5 (10,000 free) — [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing)

### Inferences
- **[inference] Matrix sizing.** A day with about 40 candidate nodes (POIs, restaurants and hotel) is a 40×40 = 1,600-cell matrix. If Google bills Route Matrix per element, as the legacy Distance Matrix did (not confirmed on the page I read), one day-plan uses about 16% of the monthly 10k free Essentials events. A 5-day trip plus replans would exhaust the free tier after a handful of trips. Self-hosted OSRM or Valhalla makes this free.
- **[inference] RAM.** Turkey is about 1/100 of the planet by PBF size, so self-hosted RAM should fit comfortably in a 4–8 GB VPS for car plus foot. This is extrapolated, not measured; verify with a test import. Pre-processing may need more RAM than serving.
- **[inference] Recommendation:**
  - **OSRM (car + foot, MLD)** for matrices and routes, with VROOM in the same docker-compose. This is the classic stack and VROOM speaks OSRM natively.
  - Choose **Valhalla** instead if you want one engine with per-request costing ("avoid unpaved roads", "prefer ferries") and isochrones for "what can I reach in 20 minutes".
  - Rebuild weekly from Geofabrik with a cron job.
  - Use Google only optionally for traffic-aware ETAs on the driving legs of road-trip days.
- **[inference]** Public transit (İstanbul/İzmir/Ankara GTFS) would need Valhalla multimodal or OpenTripPlanner. Leave it for v2.

### Gaps
- I found no measured OSRM, Valhalla or GraphHopper RAM figures for a Turkey-sized extract.
- I did not verify the Google Route Matrix billing unit, or the Google Maps Platform Terms on caching and on mixing Google data with non-Google maps. Those terms are important if you mix Google with OSM/MapLibre.
- The ORS self-host license and the ORS page date were not confirmed.

---

## 5. AI layer: models (Oct 2026), agent patterns, RAG, caching, cost per trip and per briefing

### Takeaway
Run most calls on a **cheap fast model**: Claude Haiku 5.5 at $0.10/$0.50 per MTok for prompts up to 100k tokens, or Gemini 3.5 Flash-Lite at $0.30/$2.50. Escalate to a mid-tier model (Claude Sonnet 5.5 at $2/$10) only for initial trip structuring or hard cases. Cache static prompts. With the solver doing the heavy lifting, a 5-day trip costs about **$0.01 on Haiku-class models or about $0.15 on Sonnet-class models**, and a daily briefing about $0.001 or $0.015 (see the inferences for the arithmetic).

### Cited Findings
- **Anthropic list prices (official), USD per MTok as input / output:**

  | Model | Input | Output | Notes |
  |---|---|---|---|
  | Claude Haiku 5.5 | $0.10 | $0.50 | prompts ≤100k tokens; $0.50/$2.50 above; cache hit $0.01 |
  | Claude Sonnet 5.5 | $2 | $10 | cache hit $0.10 (0.05×); 1h cache write $4 |
  | Claude Sonnet 5 | $2 | $10 | the planned rise to $3/$15 was cancelled |
  | Claude Opus 5.5 | $4 | $20 | |
  | Claude Haiku 4.5 | $1 | $5 | |

  - Batch API is 50% off, for example Haiku 5.5 at $0.05/$0.25 and Sonnet 5.5 at $1/$5. Batch and caching discounts stack.
  - Web search costs $10 per 1,000 searches.
  - Claude 4.7+ models use a tokenizer that produces about 30% more tokens for the same text.
  - Haiku 5.5 does not get the 1M context.

  — [Claude pricing docs](https://platform.claude.com/docs/en/about-claude/pricing)
- **Google Gemini (official, page updated 22 Oct 2026), USD per MTok as input / output:**

  | Model | Input | Output | Notes |
  |---|---|---|---|
  | Gemini 3.5 Flash-Lite | $0.30 | $2.50 | batch $0.15/$1.25 |
  | Gemini 3.8 Flash | $0.75 | $3.75 | **rises to $1.50/$7.50 on 1 Jan 2027** |
  | Gemini 4 Argon (flagship) | $2 | $10 | **rises to $4/$20 on 1 Dec 2026**; no free tier |
  | Gemini 2.5 Flash-Lite | $0.10 | $0.40 | |
  | Gemini Embedding 2 | $0.20 (text) | – | |

  - Search grounding: Gemini 3+ gets 5,000 free per month, then $14 per 1,000. Google Maps grounding: 5,000 free per month, then $14 per 1,000.
  - **Free-tier data is "used to improve our products"**; paid-tier data is not.

  — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- **OpenAI** (secondary sources only): GPT-5.5 at $5/$30, GPT-5.4-mini at $0.75/$4.50 and GPT-5.4-nano at $0.20/$1.25 per MTok — [morphllm.com](https://morphllm.com/openai-api-pricing). Older GPT-5 nano was $0.05/$0.40, and GPT-5 mini prices conflict ($0.25/$2.00 versus $0.125/$1.00) — [pricepertoken](https://pricepertoken.com/pricing-page/model/openai-gpt-5-mini). Not verified on openai.com.
- **Open models on Cloudflare Workers AI:**
  - 10,000 Neurons/day free, then $0.011 per 1,000 Neurons.
  - gpt-oss-120b $0.35/$0.75; gpt-oss-20b $0.20/$0.30; Gemma 4 26B A4B $0.10/$0.30; Qwen3 30B-A3B $0.051/$0.335; Llama 3.3 70B $0.293/$2.253 per MTok.
  - **bge-m3 embeddings $0.012/MTok.**

  — [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- **Agent-pattern evidence:**
  - LLM-Modulo binary critics with back-prompts improve validity — [arXiv 2405.20625](https://arxiv.org/pdf/2405.20625)
  - TriFlow's retrieval → planning → governance pipeline with bounded refinement — [arXiv 2512.11271](https://arxiv.org/abs/2512.11271)
  - ITINERA's preference-aware retrieval over a POI database — [alphaxiv 2402.07204](https://alphaxiv.org/abs/2402.07204)
  - TP-RAG benchmarks retrieval-augmented travel agents — [arXiv 2504.08694](https://arxiv.org/pdf/2504.08694)

### Inferences
- **[inference] Model routing for this app:**
  - Default (intent parsing, briefing, replan explanations, receipt parsing): **Claude Haiku 5.5**, or **Gemini 3.5 Flash-Lite** as an equivalent alternative.
  - First-pass trip skeleton (overnight cities, themes, must-sees) and anything the critics reject twice: **Claude Sonnet 5.5**.
  - Offline enrichment jobs (Turkish descriptions of POIs, category tagging, de-duplication judgments): the **Batch API** at 50% off.
  - Avoid Gemini's *free* tier for real user data, because free-tier data is used to improve Google's products (a KVKK problem, see §9). Free tier is fine for development with synthetic data.
  - Plan for Gemini's announced price doubling on 1 Jan 2027.
- **[inference] Token model for one 5-day trip.** Assumptions: Turkish text, about 8k-token static system prompt plus tool schema (cached), and about 150 candidate POIs × 60 tokens per call.
  - Calls: intent parse (2k in / 0.5k out), candidate utility scoring (10k / 2k), and 5 day-narratives (3k / 0.8k each). That totals about 30k uncached input, about 32k cached input and about 7k output.
  - **Sonnet 5.5:** 30k × $2/M = $0.06; cached reads about $0.003 plus a cache write of about $0.02; output 7k × $10/M = $0.07. **About $0.15 per trip.**
  - **Haiku 5.5:** about $0.003 + $0.0004 + $0.0035, so **about $0.007 per trip.**
  - **Gemini 3.5 Flash-Lite:** about 62k × $0.30/M + 7k × $2.50/M, so **about $0.04 per trip.**
  - **Daily briefing** (4k in including weather, plan and POI facts; 0.7k out): Sonnet 5.5 about $0.015, Haiku 5.5 about $0.0008.
  - **Replan explanation** (3k in / 0.3k out): Sonnet about $0.009, Haiku about $0.0005.
  - The new tokenizer's +30% is within the error bars of these assumptions.
- **[inference] Per-MAU LLM cost.** Assume one 5-day trip per month plus 5 briefings and 5 replans per user.
  - Haiku-only: about $0.014/MAU, so $1.4 / $14 / $140 per month at 100 / 1k / 10k MAU.
  - Sonnet for generation with Haiku for the rest: about $0.16/MAU, so $16 / $160 / $1,600.
  - The cheap-first routing is therefore what keeps a free public app viable.
- **[inference] RAG design:**
  - **Retrieval** is mostly *structured*: a PostGIS corridor or radius query plus category, opening-hours and price filters. Add a pgvector similarity rerank on a Turkish/English POI description embedding for "vibe" queries ("sakin, yerel, manzaralı çay bahçesi").
  - **Embeddings:** bge-m3 (multilingual, $0.012/MTok on Workers AI, or self-host) or Gemini Embedding 2. A 50k-POI corpus at about 150 tokens is about 7.5M tokens, under $0.10 one-off on bge-m3.
  - **Tool use:** expose `search_places`, `get_place`, `solve_day`, `check_plan`, `fx_convert` and `weather` as tools, but call the solver deterministically from code rather than letting the agent loop freely. A bounded loop of at most 2 repair rounds, as in TriFlow's "bounded iterative refinement", caps cost.
  - **Structured outputs and JSON schema** for every LLM step, validated with Zod or Pydantic.
  - **Prompt caching:** put the static system prompt, tool definitions and the Turkey style guide first in the prompt. Use the 1-hour cache for trip-session context. Anthropic charges 0.05× for cache reads on Sonnet and Opus 5.5.
- **[inference]** Avoid paid LLM web search ($10 per 1k searches on Claude, $14 per 1k on Gemini above free) in the main flow. Use your own curated DB and keep web search for a rare "is this place still open?" verification job.

### Gaps
- I did not verify OpenAI prices on openai.com.
- I found no Turkish-specific tokenization ratios, so the cost estimates assume roughly English-like token counts and could be 1.3–2× low for Turkish text.
- I found no published Turkish-language quality comparison of Haiku 5.5, Gemini 3.5 Flash-Lite and open models (Gemma 4, Qwen3, gpt-oss) for travel writing.

---

## 6. Data layer: Postgres + PostGIS + pgvector, schema, opening hours, prices, freshness

### Takeaway
Use **one Postgres with PostGIS and pgvector**: Supabase for auth, storage and edge functions in one place, or Neon for scale-to-zero. Seed places from **OSM, Overture/Foursquare OS Places and Wikidata/Wikivoyage**, curated for Turkey. Store opening hours as raw OSM `opening_hours` strings evaluated with a library. Keep prices as dated observations, never as a single number. Mind ODbL share-alike when you combine OSM data.

### Cited Findings
- **Supabase (official pricing).**
  - Free: 500 MB DB, 50,000 MAU, 5 GB egress, 1 GB file storage, 500k Edge Function invocations, 200 realtime connections; 2 active projects; **paused after 1 week of inactivity**.
  - Pro: from $25/month with $10 compute credit. 8 GB DB then $0.125/GB; 100k MAU then $0.00325/MAU; 250 GB egress then $0.09/GB; 2M function invocations then $2/M. Never paused.
  - [Supabase pricing](https://supabase.com/pricing)
- **Neon:**
  - Free: 100 CU-hours and 0.5 GB storage per project per month; scales to zero after 5 minutes idle; up to 100 projects. pgvector and PostGIS are available on all plans.
  - Launch: $0.106/CU-hour and $0.35/GB-month.
  - [Neon pricing](https://neon.com/pricing); secondary details: [jetadmin Neon review](https://www.jetadmin.io/blog/neon-review/)
- **Foursquare OS Places:** 100M+ POIs, open-sourced Nov 2024 under **Apache-2.0**, refreshed monthly. Quality varies, so filter by confidence — [OSM community thread](https://community.openstreetmap.org/t/foursquare-releases-100m-poi-dataset-under-apache-2-0/121883)
- **Overture Places:** multi-license since Sep 2025. Foursquare-sourced records are Apache-2.0 and the rest is CDLA-Permissive-2.0. Records can be filtered by source. April 2026 counts were Meta about 59.4M, Microsoft about 7.3M and Foursquare about 6.7M, for 64M+ points in total — [Overture release notes Sep 2025](https://docs.overturemaps.org/blog/2025/09/24/release-notes/); [Overture places guide](https://docs.overturemaps.org/guides/places)
- **OSM-derived products** are ODbL "Produced Works" requiring OpenStreetMap attribution, for example the Protomaps basemap — [Protomaps downloads](https://docs.protomaps.com/basemaps/downloads)
- **opening_hours parsing:**
  - opening_hours.js evaluates the OSM tag, returning open now, next change, and so on. It has a holiday table keyed by country; Turkey coverage is not confirmed.
  - A Rust crate (`opening-hours`, with Python bindings) embeds holidays from nager/workalendar.
  - A separate npm package computes Turkish holidays (low health score).
  - [opening_hours npm](https://npmjs.com/package/opening_hours); [opening-hours-rs](https://github.com/remi-dupre/opening-hours-rs); [turkish-holidays-lib](https://mcp.depscope.dev/pkg/npm/turkish-holidays-lib)
- Weekly or daily OSM refresh is possible because the Geofabrik Turkey extract is rebuilt daily — [Geofabrik](https://download.geofabrik.de/europe/turkey.html)

### Inferences
- **[inference] Schema sketch:**
  - `places(id, source_ids jsonb {osm, fsq, overture, wikidata}, name_tr, name_en, category, subcategory, geom geography(Point), region_code (il/ilçe), tags jsonb, typical_visit_min, indoor bool, accessibility jsonb, quality_score, license_source, last_verified_at, status (active / closed_temp / closed_perm))`
  - `place_texts(place_id, lang, description, tips, embedding vector(1024))`
  - `opening_hours(place_id, oh_string, source, valid_from, valid_to, verified_at)`, keeping the raw OSM syntax. Override rows for bayram, Ramazan or seasonal changes go in as higher-priority rows with date ranges.
  - `price_observations(place_id, item (entry / menu_avg / room_night / tea), amount, currency, observed_at, source (user / receipt / web / llm_estimate), confidence)`
  - `trips(id, user_id, start_date, end_date, base_currency, budget_total, prefs jsonb)`
  - `trip_days(trip_id, day_no, date, start_place_id, end_place_id, solver_input jsonb, solver_output jsonb, version)`
  - `trip_stops(day_id, seq, place_id, planned_arrival, planned_departure, state, locked bool, alternatives jsonb)`
  - `expenses(id, trip_id, day_id, stop_id, category, amount, currency, fx_rate_to_base, fx_source, amount_base, paid_at, receipt_path, ocr jsonb, client_uuid unique)`, where `client_uuid` makes offline sync idempotent
  - `fx_rates(date, currency, forex_selling, banknote_selling, source)`
  - `cpi_index(month, value)`
  - `events(trip_id, type, payload, created_at)`, an audit log of skip/late/closed events that also serves as a replay or debug log
- **[inference]** Evaluate `opening_hours` **on the client**, with opening_hours.js working offline from the cached trip pack, and on the server for the solver. Turkish moving holidays (Ramazan and Kurban Bayramı) need a Turkey table supplied by you or via `PH` rules. Test that before trusting it.
- **[inference] Freshness pipeline** (cron on the VPS or a GitHub Action):
  - **Weekly:** pull OSM diffs for Turkey.
  - **Monthly:** pull Overture/FSQ Turkey slices.
  - Conflate by distance plus name similarity (pg_trgm), with Wikidata QIDs as anchors.
  - A batch-LLM job writes Turkish/English descriptions for new POIs.
  - **In app:** user reports such as "kapalıydı" or "fiyat değişti" set `status` and `last_verified_at`.
  - POIs not verified in more than 12 months get a lower utility in the solver.
- **[inference] Licensing.** If you import OSM POIs into your places DB and serve it publicly, that DB is an ODbL derivative database, meaning share-alike for the data, not the code. Overture/FSQ Apache/CDLA data is more permissive. Keeping OSM-derived rows tagged with `license_source` keeps that obligation manageable.
- **[inference] Supabase or Neon.** For a solo developer, Supabase wins on fewer moving parts: auth, storage for receipts, RLS and edge functions. The free-tier pause after 1 week of inactivity matters between trips during the personal phase, so either go to Pro ($25) at public launch or use Neon plus separate auth.

### Gaps
- I found no measured OSM `opening_hours` completeness for Turkish POIs.
- I did not check whether the Ministry of Culture and Tourism or MüzeKart publish machine-readable museum hours and prices.
- I did not verify the Wikivoyage (CC BY-SA) reuse terms in this pass.

---

## 7. App platform and offline-first: Expo/React Native vs Flutter vs PWA; MapLibre + PMTiles; local DB sync

### Takeaway
Build with **Expo (React Native, TypeScript)**. Use one language across app, Workers and edge functions, rely on mature background-location and geofencing APIs, and reach native MapLibre via `@maplibre/maplibre-react-native` (v11+, new architecture). Go offline-first with a **downloadable "trip pack"**: a PMTiles map extract plus a SQLite bundle of POIs, hours, matrices and the plan. Add an outbox for expenses and events. Do not adopt a general sync engine on day one; PowerSync is the upgrade path.

### Cited Findings
- React Native 0.82 (8 Oct 2025) was the first release to run exclusively on the New Architecture, and Expo SDK 55 (Feb 2026) removed the legacy architecture entirely. Expo is "often the shortest path for solo developers who already know React". Flutter's case is Dart plus its own rendering; it reportedly holds about 46% cross-platform share versus RN's 35–38%, a secondhand Statista figure — [pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/8279/react-native-2026-stack-choices-vs-flutter) (SEO-style source; versions conflict across sources)
- MapLibre React Native wraps MapLibre Native, and **from v11 only the new architecture is supported**. For production, bring your own style and tiles or use a provider such as MapTiler or Stadia — [MapLibre RN docs](https://maplibre.org/maplibre-react-native/docs/setup/getting-started); [GitHub](https://github.com/maplibre/maplibre-react-native)
- **MapLibre Android 11.7.0+** supports PMTiles sources via `pmtiles://https://…` and `pmtiles://file://…`. `pmtiles://asset://` is not supported because byte-range reads are missing — [MapLibre Android PMTiles example](https://maplibre.org/maplibre-native/android/examples/data/PMTiles/). The iOS shipping version is less clearly documented; iOS 6.14.0 (May 2025) has a PMTiles metadata fix — [MapLibre Native iOS distribution](https://swiftpackageregistry.com/maplibre/maplibre-gl-native-distribution)
- **Protomaps:**
  - The daily full-planet basemap build is about 120 GB (z0–15).
  - Regional cut-outs come from `pmtiles extract`; each extra zoom level roughly doubles the size, so use `--maxzoom`.
  - It is ODbL, with OSM attribution required.
  - [Protomaps docs](https://docs.protomaps.com/basemaps/downloads)
- **PowerSync:**
  - Free: 2 GB synced per month, 500 MB hosted, 50 peak concurrent clients; deactivated after about 1 week of inactivity (the page also says 2 weeks).
  - Pro: from $49/month, 30 GB synced, 1,000 peak clients.
  - **Self-hosted Open Edition:** free and source-available.
  - [PowerSync pricing](https://www.powersync.com/pricing)
- Expo background location and geofencing need a development build, not Expo Go — [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
- On-device OCR: `expo-mlkit-ocr` wraps ML Kit Text Recognition v2 on iOS and Android, returning blocks and lines with bounding boxes. ML Kit runs on device and **offline** — [expo-mlkit-ocr](https://awesome.ecosyste.ms/projects/github.com%2Frbayuokt%2Fexpo-mlkit-ocr); [ML Kit](https://developers.google.com/ml-kit/terms.)

### Inferences
- **[inference] Why not a PWA.** The core features are background geofencing, offline maps on long rural drives, scheduled local notifications and a camera receipt flow. A PWA is weakest exactly there, especially on iOS. A Next.js web companion for planning on desktop can share the TS domain code later.
- **[inference] Why not Flutter.** It is viable, and flutter-maplibre-gl supports PMTiles, but it would add Dart next to the TS backend and the TS/Python solver glue. With Claude Code as the assistant, a single TypeScript codebase is cheaper to maintain.
- **[inference] Trip pack design.** On "download trip", fetch from R2:
  1. A PMTiles extract per route corridor or province set at maxzoom about 14. Rough size is tens to a few hundred MB per region; measure it.
  2. A SQLite file with trip POIs, alternatives pools, `opening_hours` strings, per-day duration matrices, the plan, and FX rates for the trip dates.
  3. Pre-rendered Turkish briefing texts for each day, generated the night before when online, with a template fallback.

  Store the pack with `expo-file-system` and use `pmtiles://file://`. Verify iOS PMTiles support early, and fall back to MBTiles or an offline pack if it is missing.
- **[inference] Sync.**
  - Use the local SQLite (expo-sqlite, or op-sqlite for speed) as the source of truth during a trip.
  - Write expenses and events to an `outbox` table with client UUIDs, and flush to Supabase via a REST/RPC endpoint when online. The server uses upsert on `client_uuid`.
  - Conflicts are rare because of single-user trips, so last-writer-wins per row is fine.
  - Switch to PowerSync (self-hosted Open Edition or Pro) only if you add shared or group trips with multi-device live editing. Its free tier's 50 peak clients and inactivity deactivation make it fit only the personal phase.
  - WatermelonDB and ElectricSQL were not researched in this pass.
- **[inference] Basemap hosting.** PMTiles for all of Turkey on R2: storage is free up to 10 GB, egress is free, and reads are Class B operations with 10M/month free (see §8). That gives map tiles at about $0.

### Gaps
- I found no authoritative iOS PMTiles release note for MapLibre Native.
- I found no measured PMTiles sizes for a Turkey extract at z14/z15.
- I did not research the Expo EAS free-tier build limits, the Apple Developer fee ($99/year) or the Google Play fee ($25 once). These are widely known but not verified here.
- WatermelonDB and ElectricSQL status in 2026 is not verified.

---

## 8. Budget engine: planned vs actual, categories, daily envelope, receipt OCR, FX (TCMB), inflation adjustment

### Takeaway
The budget engine is plain deterministic code. Planned costs come from solver-chosen places multiplied by their latest price observation, adjusted for inflation. Actual costs are expenses converted at the **TCMB daily rate of the payment date**. The daily envelope is the remaining budget divided by remaining days, with category caps. Receipts are captured with on-device ML Kit OCR, then parsed by a cheap LLM into structured fields when online. TCMB's `today.xml` is free and needs no key; historical series and CPI (TÜFE) come via EVDS with an API key.

### Cited Findings
- **TCMB `today.xml`:**
  - Root `<Tarih_Date Tarih="23.10.2026" Date="10/23/2026" Bulten_No="2026/201">`.
  - Each `<Currency Kod CurrencyCode>` has `Unit` (100 for JPY), `ForexBuying/ForexSelling`, `BanknoteBuying/BanknoteSelling` and `CrossRateUSD/Other`. Some banknote fields are empty.
  - Values on 23 Oct 2026: **USD ForexSelling 49.6540 TRY, EUR ForexSelling 55.5997 TRY**.
  - [TCMB today.xml](https://www.tcmb.gov.tr/kurlar/today.xml)
- **EVDS:** an API key comes from registering on evds2.tcmb.gov.tr, and newer clients send the **key in the HTTP header**, not the URL. The daily USD series code is `TP.DK.USD.S.YTL` (from an unofficial package) — [evdspy on PyPI](https://pypi.org/project/evdspy); [tcmb package](https://pypi.org/project/tcmb/0.4.1)
- On-device ML Kit OCR works offline, via `expo-mlkit-ocr` — [expo-mlkit-ocr](https://awesome.ecosyste.ms/projects/github.com%2Frbayuokt%2Fexpo-mlkit-ocr)
- Cheap multimodal or text models for parsing: Claude Haiku 5.5 at $0.10/$0.50 per MTok — [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing); Gemini 3.5 Flash-Lite at $0.30/$2.50 — [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)

### Inferences
- **[inference] Engine rules:**
  - **Currencies:**
    - Each trip has a `base_currency`, TRY by default; EUR or USD for diaspora or foreign users.
    - Each expense stores the original amount and currency, plus `fx_rate_to_base` and `fx_source`, frozen at entry time.
    - Use the **ForexSelling** rate of the last bulletin on or before the payment date. On weekends and holidays, carry the previous bulletin forward.
    - For cash spent from exchanged currency, optionally record the user's actual döviz bürosu rate.
  - **Planned:** for each stop, the expected price comes from the newest relevant `price_observations` row multiplied by CPI_now / CPI_at_observation, using monthly TÜFE from EVDS. That gives the inflation adjustment. The result carries a confidence band derived from the observation's age and source. Accommodation and fuel are separate lines; fuel is the drive km from OSRM times consumption times the current pump price, entered manually or from a source.
  - **Envelope:**
    - `daily_allowance = (budget_total − spent_to_date − committed_future (booked hotels)) / remaining_days`.
    - Category envelopes cover food, tea and coffee, entry fees, shopping, transport, fuel and accommodation.
    - When the user is over the envelope, the replanner prefers cheaper alternatives through the solver: a budget penalty in the objective, or a hard cap dimension of "money" in OR-Tools.
  - **Variance views:** planned versus actual per day and per category, plus a burn-down chart.
- **[inference] Receipts.**
  1. On device: photo → ML Kit text, which works offline → stored in the outbox.
  2. When online, send the OCR text to Haiku 5.5 with a JSON schema: merchant, date, total, currency, VAT (KDV), and line items.
  3. Send the image only if the text parse fails.
  4. Text-only parsing costs about $0.0005 per receipt at Haiku 5.5 prices. Images stay on device or in private storage.
- **[inference]** Do not call TCMB from every client. Fetch once a day server-side by cron into `fx_rates`, and ship the relevant rates inside the trip pack for offline conversion.

### Gaps
- I did not verify the official EVDS documentation, the exact CPI series code, or the rate limits.
- I found no benchmark of ML Kit accuracy on Turkish thermal receipts, including dotless/dotted ı/i and "TOPLAM"/"KDV" layouts.
- I found no reliable open source of Turkish fuel prices (EPDK) in this pass.

---

## 9. Hosting at near-zero cost, cost at 100 / 1,000 / 10,000 MAU, and abuse protection

### Takeaway
Use the cheapest maintainable split: **Supabase** (DB, auth and storage), **Cloudflare Workers + R2** (API edge, rate limiting, PMTiles and trip-pack hosting with free egress), and **one small Hetzner VPS** for OSRM, VROOM or OR-Tools and cron jobs. Fixed infrastructure costs about $5–40 per month across the three scales. The **LLM bill dominates** and is controlled by the model choice and per-user quotas. A free public AI endpoint needs authentication plus per-user quotas plus provider spend caps; IP rate limits alone are not enough.

### Cited Findings
- **Cloudflare Workers:**
  - Free: 100k requests/day and 10 ms CPU per invocation.
  - Paid: **$5/month minimum**, 10M requests then $0.30/M; 30M CPU-ms then $0.02 per M CPU-ms; up to 5 min CPU per invocation; **no egress charges**.
  - **R2:** 10 GB-month free, 1M Class A and 10M Class B operations free, then $0.015/GB-month. **Egress free.**
  - **D1:** free 5M rows read/day and 5 GB.
  - **KV:** free 100k reads/day.
  - **Durable Objects:** free 100k requests/day.
  - **Queues:** free 10k operations/day.
  - [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- **Supabase** Free: 500 MB DB, 50k MAU, 5 GB egress, pauses after 1 week inactive. Pro: $25 with 8 GB DB, 100k MAU, 250 GB egress — [Supabase pricing](https://supabase.com/pricing)
- **Hetzner** raised prices twice in 2026: on 1 Apr 2026 (cloud +30–43%) and on 15 Jun 2026 (dedicated-vCPU and AMD shared lines roughly ×2–×3; ARM and Intel shared about +30%). Reported current prices: **CX23 €5.49/month** and **CAX11 €5.99/month** (DE/FI). Not verified on hetzner.com — [heise](https://heise.de/-11333037); [wz-it.com](https://wz-it.com/blog/hetzner-preiserhoehung-juni-2026-cpx-ccx-alternativen/); [igorslab](https://www.igorslab.de/en/hetzner-to-significantly-increase-prices-for-cloud-and-dedicated-servers-from-april-2026/)
- **Vercel Hobby** is limited to personal, non-commercial use. Ads or payment processing count as commercial; **donation requests explicitly do not**. Hobby allowances of about 100 GB transfer and 1M function invocations come from secondary sources — [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines); [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- **Neon** Free: 100 CU-hours/month and scale-to-zero — [Neon pricing](https://neon.com/pricing)
- **Abuse protection:**
  - **Turnstile** challenges bots invisibly and can be used without proxying through Cloudflare. Cloudflare recommends pairing it with rate limiting, and Free-plan rate-limit rules are per-IP over short periods with Block as the action — [Cloudflare bots solution](https://developers.cloudflare.com/use-cases/solutions/stop-malicious-bots/index.md); [Cloudflare forms solution](https://developers.cloudflare.com/use-cases/solutions/protect-sensitive-forms-fraud-abuse/)
  - Per-IP limits were easily evaded with many IPs, and requiring a key stopped the abuse — [Troy Hunt](https://www.troyhunt.com/fighting-api-bots-with-cloudflares-invisible-turnstile/)
  - LLM endpoints are a "cost-exploitation" target — [vibe-eval 2026](https://vibe-eval.com/backend-security/api-abuse-protection/)

### Inferences
#### Synthesized reference stack (inference)
- **Client:** Expo (RN, TS), `@maplibre/maplibre-react-native`, PMTiles trip packs, expo-sqlite with an outbox, expo-location geofencing, local notifications, and expo-mlkit-ocr.
- **Edge/API:** Cloudflare Workers (TS, using Hono or similar) for auth check, quotas, LLM proxy and trip-pack signing. Rate limiting and per-user quotas use Durable Objects or KV counters. R2 holds PMTiles and packs.
- **Core data:** Supabase Postgres with PostGIS, pgvector and pg_trgm. Supabase Auth: anonymous sign-in upgraded to email or Apple/Google. RLS on trips and expenses. Private storage for receipts.
- **Compute box:** Hetzner ARM VPS (sized after a Turkey test import) running docker-compose with OSRM (car, foot), VROOM, and a small Python FastAPI service for OR-Tools when needed. Nightly cron jobs handle the OSM refresh, TCMB FX fetch and batch-LLM enrichment. The 10 ms free-tier CPU limit on Workers rules out running the solver there.
- **LLM:** Haiku 5.5 by default, Sonnet 5.5 for escalation; Gemini 3.5 Flash-Lite as a fallback provider.
- **Weather:** Open-Meteo.
- **FX:** TCMB.

#### Monthly cost estimate (inference; LLM from §5, infrastructure from the cited unit prices)

| MAU | Supabase | Cloudflare | VPS | LLM | Total |
|---|---|---|---|---|---|
| 100 | $0 (Free; risk of pausing) or $25 | $0 | ~€6–12 | $1.5 (Haiku) to $16 (Sonnet-heavy) | **≈ $8–55** |
| 1,000 | $25 | $5 | ~€6–15 | $14–160 | **≈ $50–205** |
| 10,000 | $25 + possible compute add-on | $5–10 | ~€15–30 for a bigger box | $140–1,600 | **≈ $200–1,700** |

- At 10,000 MAU, R2 egress stays free but PMTiles reads may exceed 10M Class B operations, at $0.36/M beyond.
- One-off developer-account fees and domains are excluded.
- The 10× spread at 10k MAU comes entirely from the model choice, so cheap-model defaults are mandatory.

#### Abuse controls (inference)
1. Every AI call requires a session (anonymous auth plus Turnstile at sign-up).
2. Server-side quotas per user: for example 3 trip generations per month, 1 briefing per trip-day, 20 replan explanations per day. Store counters in Postgres or Durable Objects.
3. Global daily budget circuit-breaker: if the day's LLM spend exceeds $X, fall back to template text, since the solver still works without the LLM.
4. Per-IP rate limiting at the edge.
5. Hard monthly spend limits in each provider console.
6. Optional "bring your own API key" for power users.
7. Apple App Attest / Play Integrity attestation is worth adding when going public (not researched here).

### Gaps
- I did not verify Hetzner prices for 8–16 GB RAM tiers on hetzner.com.
- I did not research Fly.io or Render pricing in 2026.
- I did not verify Anthropic or Google console spend-cap features or Supabase anonymous-auth rate limits.
- Expo push and EAS free-tier limits are unverified.

---

## 10. Privacy and legal (KVKK), licensing, sustainability

### Takeaway
Location trails and expenses are personal data. A public app needs an *aydınlatma metni* (privacy notice), purpose-specific consent where appropriate (background location, push by type), data minimization (keep raw GPS on device), and a plan for **cross-border transfer**. Supabase, Cloudflare and US LLM APIs are abroad. Since the 1 June 2024 amendment (Law 7499), such transfers rely on Board-approved **standard contracts**, which must be notified to the Authority within 5 business days. For licensing, choose **AGPL-3.0** for the server to prevent closed SaaS clones, or MIT/Apache to maximize reuse. Fund the app with donations, grants and community data contributions, which Vercel explicitly treats as non-commercial.

### Cited Findings
- **Law 7499** amended KVKK Art. 9, effective 1 June 2024, making standard contracts an appropriate safeguard for transfers abroad. Standard contracts must be **notified to the Authority within 5 business days** of signature. The Board approved the standard contract texts (C2C, C2P, P2P) by decision 2024/959 of 4 June 2024, and an online "Standart Sözleşme Bildirim Modülü" followed by decision 2024/1793 of 17 Oct 2024 — [KVKK: Standart Sözleşme Bildirim Modülü](https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu); [KVKK: standard contract documents](https://www.kvkk.gov.tr/Icerik/7938/Standart-Sozlesmeler-ve-Baglayici-Sirket-Kurallarina-Iliskin-Dokumanlar-Hakkinda-Kamuoyu-Duyurusu)
- Practitioners state that, after the amendment, explicit consent is no longer a sustainable basis for *routine* transfers abroad; cloud users should rely on standard contracts and handle sub-processors, data return and deletion in the contract — [hukukcularevi.com](https://hukukcularevi.com/veri-merkezi-bulut-hizmet-sozlesmeleri-veri-lokalizasyonu/)
- **VERBİS:** Board decision 2025/1572 (4 Sep 2025) exempts small businesses with fewer than 10 employees and a balance sheet under 10M TL, even where their main activity is processing special-category data. Older decisions give different thresholds (50 employees / 100M TL), so sources conflict. **Exemption from registration does not remove** the duties of notice, consent, security measures and breach notification — [ekonomim.com](https://www.ekonomim.com/sehirler/kvkkdan-kucuk-isletmelere-verbis-muafiyeti-haberi-846491); [bilalalyar.av.tr](https://bilalalyar.av.tr/?p=79205); [cumhuriyet.com.tr](https://www.cumhuriyet.com.tr/haber/hukukcular-kvkk-hakkinda-bilinmesi-gerekenleri-anlatti-kisisel-veriler-sohbet-konusu-degildir-1764438)
- KVKK announcement on mobile apps: push notification consents must be separable by type, with controls in the app or OS settings; one-tap bundled consent undermines "free will" — [Alomaliye](https://www.alomaliye.com/2026/01/14/mobil-uygulamalarda-tek-tik-riza-donemi-bitiyor-bildirim-amaclari-ayrilacak/amp/)
- Gemini free tier: prompts are "used to improve our products"; the paid tier does not — [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Vercel: "donation requests are explicitly not treated as commercial" under Hobby — [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines)
- **Data and code license precedents:**
  - OSM-derived maps are ODbL with attribution — [Protomaps](https://docs.protomaps.com/basemaps/downloads)
  - Foursquare/Overture POIs are Apache-2.0 or CDLA-Permissive-2.0 — [Overture](https://docs.overturemaps.org/blog/2025/09/24/release-notes/)
  - Open-Meteo is AGPLv3 code with CC BY 4.0 data — [Open-Meteo](https://open-meteo.com/en/terms)

### Inferences
- **[inference] KVKK design checklist:**
  - **Minimize:** live GPS stays on device and is used for geofences and replanning locally. Only send coarse position (rounded, at the moment of a replan request) to the server and LLM. Never send names, emails or phone numbers to LLM providers; use a pseudonymous user UUID.
  - **Purposes and legal bases:** account, trip and expense storage are necessary for providing the service (Art. 5/2-c, contract). Background location gets a separate opt-in with a clear explanation. Push notifications use per-type toggles and operational types only, since the app has no marketing.
  - **Cross-border:** list each processor (Supabase region, for example EU-Frankfurt; Cloudflare; Anthropic/Google; Hetzner DE/FI). Sign or accept their DPAs, check whether a Board-approved standard contract can be executed with each provider, and file the 5-business-day notification. This part needs a KVKK lawyer's confirmation before the public launch, because the large US providers' standard terms do not use the Turkish standard contract text by default.
  - **User rights (Art. 11):** export and delete-my-data endpoints; receipt images are deleted with the trip.
  - **Retention:** delete raw event logs after N months; keep anonymized aggregates for improving POI quality.
- **[inference]** For the *personal-use phase*, KVKK obligations essentially do not bite, because the developer processes their own data. They begin once other users onboard.
- **[inference] License choice:**
  - AGPL-3.0 for the backend and app forces anyone running a modified public service to share changes, which protects a community project from closed forks.
  - MIT/Apache-2.0 gives maximal adoption.
  - A common split is AGPL for the app and server with **ODbL/CC BY-SA for the curated Turkey places dataset** (compatible with the OSM and Wikivoyage share-alike origins) and CC BY for documentation.
  - Keep secrets and provider keys out of the repo; publish a `.env.example`.
- **[inference] Sustainability:**
  1. Keep costs at about $30–50/month at 1k MAU via cheap models and quotas.
  2. Accept donations (GitHub Sponsors, Open Collective, Buy Me a Coffee), which stays compatible with Vercel Hobby's non-commercial rule.
  3. Accept community data contributions (place corrections, prices, tea-garden tips) that flow back upstream to OSM and Wikivoyage where licenses allow.
  4. Offer optional bring-your-own-API-key.
  5. Apply for open-source or public-interest grants.
  6. Prefer providers with startup or open-source credit programs.

### Gaps
- I did not verify NLnet/NGI eligibility for Turkish individuals, TÜBİTAK or other Turkish grant programs, or GitHub Sponsors availability in Turkey.
- I found no KVKK guidance specific to *location data* in mobile apps.
- It is unclear whether an individual (natural person) data controller running a free app must register with VERBİS. The 2025 decision text was not read directly.
- Whether Anthropic, Google or Cloudflare offer the KVKK standard contract was not checked.
