// Arka planda çalışan canlı mod + simülasyon motoru. Görünmez; hangi ekran açık olursa
// olsun konumu izler ve yakınlık bildirimlerini (uygulama içi kart + Web Notification) üretir.
import { useEffect, useRef } from "react";
import { toTrWallClock, type ProximityNotification } from "@rota/core";
import { proximity } from "../lib/core";
import { plannedIds } from "../lib/geo";
import { showNotification } from "../lib/notify";
import { notificationToSpeech } from "../features/voice/speak";
import { speak } from "../features/voice/useSpeech";
import { simPath, stopSimulation, tickSimulation } from "../lib/simulation";
import { usePack } from "../state/pack";
import { useSettings } from "../state/settings";
import { useTrip } from "../state/trip";
import { toast, useUi, type PositionSource } from "../state/ui";
import { navigate } from "./router";

const LIVE_THROTTLE_MS = 15_000;
const SIM_EVAL_MS = 1_200;
const SIM_TICK_MS = 250;

function deliver(ns: ProximityNotification[], source: PositionSource) {
  if (!ns.length) return;
  useUi.getState().addFeed(ns.map((notification) => ({ at: Date.now(), source, notification })));
  for (const n of ns) {
    toast({
      kind: "discovery",
      title: n.title,
      body: n.body,
      action: { label: "Etrafımda gör", run: () => navigate("etrafim") },
    });
    void showNotification(n.title, n.body, n.placeId);
    // Sesli rehber açıksa sürücüye sesli söyle (kapalıyken sessiz)
    speak(notificationToSpeech(n));
  }
}

/** Canlı modda bugünün (yoksa seçili günün) planı */
function liveDay() {
  const { plan, selectedDay } = useTrip.getState();
  if (!plan) return undefined;
  const today = toTrWallClock(new Date()).date;
  return plan.days.find((d) => d.date === today) ?? plan.days[selectedDay];
}

export function LiveEngine() {
  const live = useUi((s) => s.live);
  const simActive = useUi((s) => s.sim !== null);
  const lastEval = useRef(0);

  // ------------------------------------------------ canlı GPS
  useEffect(() => {
    if (!live) return;
    if (!("geolocation" in navigator)) {
      useUi.getState().setLiveError("Bu tarayıcı konum paylaşımını desteklemiyor.");
      useUi.getState().setLive(false);
      return;
    }
    lastEval.current = 0;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const ui = useUi.getState();
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        ui.setLiveError(null);
        ui.setPosition({
          loc,
          source: "gps",
          headingDeg: pos.coords.heading ?? undefined,
          speedKmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : undefined,
          accuracyM: pos.coords.accuracy,
          at: Date.now(),
        });
        const now = Date.now();
        if (now - lastEval.current < LIVE_THROTTLE_MS) return;
        lastEval.current = now;
        const index = usePack.getState().index;
        const trip = useTrip.getState();
        if (!index) return;
        const day = liveDay();
        const res = proximity(
          {
            position: loc,
            headingDeg: pos.coords.heading ?? undefined,
            speedKmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : undefined,
            route: day?.route,
            now: new Date(),
            plannedPlaceIds: plannedIds(day),
          },
          useSettings.getState().proximity,
          trip.proximity,
          index,
          trip.plan?.request.transport ?? "araba",
        );
        trip.setProximity(res.state);
        deliver(res.notifications, "gps");
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Konum izni verilmedi. Tarayıcı ayarlarından izin verebilir ya da Simülasyon'u kullanabilirsin."
            : err.code === err.TIMEOUT
              ? "Konum alınamadı (zaman aşımı). Açık alanda yeniden dene."
              : "Konum alınamadı.";
        useUi.getState().setLiveError(msg);
        if (err.code === err.PERMISSION_DENIED) useUi.getState().setLive(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [live]);

  // ------------------------------------------------ simülasyon
  useEffect(() => {
    if (!simActive) return;
    let last = performance.now();
    let lastSimEval = 0;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1000, now - last);
      last = now;
      const ui = useUi.getState();
      if (!ui.sim?.running) return;
      const done = tickSimulation(dt);
      if (now - lastSimEval >= SIM_EVAL_MS || done) {
        lastSimEval = now;
        const index = usePack.getState().index;
        const sim = useUi.getState().sim;
        const pos = useUi.getState().position;
        const plan = useTrip.getState().plan;
        if (index && sim && pos && plan) {
          const day = plan.days[sim.dayIndex];
          const path = simPath();
          const res = proximity(
            {
              position: pos.loc,
              headingDeg: pos.headingDeg,
              speedKmh: sim.speedKmh,
              route: path.length > 1 ? path : undefined,
              now: new Date(sim.clock),
              plannedPlaceIds: plannedIds(day),
            },
            // Simülasyon demo içindir: bildirimler ayarlardan kapalı olsa da çalışır.
            { ...useSettings.getState().proximity, enabled: true },
            sim.proximity,
            index,
            plan.request.transport,
          );
          ui.patchSim({ proximity: res.state });
          deliver(res.notifications, "sim");
        }
      }
      if (done) {
        stopSimulation();
        toast({ kind: "success", title: "Simülasyon tamamlandı", body: "Günün sonuna ulaşıldı. İstersen yeniden başlatabilirsin." });
      }
    }, SIM_TICK_MS);
    return () => window.clearInterval(timer);
  }, [simActive]);

  return null;
}
