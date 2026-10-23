import { describe, expect, it } from "vitest";
import { fetchWeather, rainWindowsFrom, weatherCodeTr } from "../src";
import { SELCUK } from "./fixtures";

const DATE = "2026-10-27";
const NOW = new Date("2026-10-26T06:00:00Z");

function body(probs: Array<number | null>, code = 2) {
  return {
    latitude: 37.95,
    longitude: 27.37,
    timezone: "Europe/Istanbul",
    hourly: {
      time: probs.map((_, h) => `${DATE}T${String(h).padStart(2, "0")}:00`),
      precipitation_probability: probs,
      temperature_2m: probs.map((_, h) => (h === 3 ? null : 14 + (h >= 6 && h <= 15 ? h - 6 : 8))),
    },
    daily: { time: [DATE], weather_code: [code], temperature_2m_max: [22.4], temperature_2m_min: [13.6] },
  };
}

function mock(res: () => Response | Promise<Response>) {
  const calls: string[] = [];
  const fn = (async (url: RequestInfo | URL) => {
    calls.push(String(url));
    return res();
  }) as typeof fetch;
  return { fn, calls };
}

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

describe("hava durumu", () => {
  it("WMO kodları Türkçe", () => {
    expect(weatherCodeTr(0)).toBe("Açık");
    expect(weatherCodeTr(2)).toBe("Parçalı bulutlu");
    expect(weatherCodeTr(63)).toBe("Yağmurlu");
    expect(weatherCodeTr(95)).toBe("Gök gürültülü fırtına");
    expect(weatherCodeTr(1234)).toBe("Hava durumu bilinmiyor");
  });

  it("yağış pencereleri ardışık saatleri birleştirir", () => {
    const p = new Array<number>(24).fill(0);
    p[2] = 70;
    p[3] = 80;
    p[5] = 60;
    p[6] = 59;
    p[23] = 90;
    expect(rainWindowsFrom(p)).toEqual([
      [120, 240],
      [300, 360],
      [1380, 1440],
    ]);
    expect(rainWindowsFrom(p, 75)).toEqual([
      [180, 240],
      [1380, 1440],
    ]);
    expect(rainWindowsFrom([])).toEqual([]);
  });

  it("Open-Meteo yanıtı WeatherDay'e çevrilir", async () => {
    const probs: Array<number | null> = new Array(24).fill(10);
    probs[15] = 70;
    probs[16] = 85;
    probs[17] = 65;
    probs[20] = null;
    const m = mock(() => json(body(probs)));
    const w = await fetchWeather(SELCUK.loc, DATE, m.fn, NOW);
    expect(w).not.toBeNull();
    expect(w!.date).toBe(DATE);
    expect(w!.summary).toBe("Parçalı bulutlu, 14–22°C");
    expect(w!.tMinC).toBe(13.6);
    expect(w!.tMaxC).toBe(22.4);
    expect(w!.weatherCode).toBe(2);
    expect(w!.hourlyPrecipProb).toHaveLength(24);
    expect(w!.hourlyPrecipProb[20]).toBe(0);
    expect(w!.hourlyTempC).toHaveLength(24);
    expect(w!.hourlyTempC.every(Number.isFinite)).toBe(true);
    expect(w!.rainWindows).toEqual([[900, 1080]]);

    const url = new URL(m.calls[0]!);
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(url.searchParams.get("latitude")).toBe("37.9507");
    expect(url.searchParams.get("longitude")).toBe("27.3686");
    expect(url.searchParams.get("hourly")).toBe("precipitation_probability,temperature_2m");
    expect(url.searchParams.get("daily")).toBe("weather_code,temperature_2m_max,temperature_2m_min");
    expect(url.searchParams.get("timezone")).toBe("Europe/Istanbul");
    expect(url.searchParams.get("start_date")).toBe(DATE);
    expect(url.searchParams.get("end_date")).toBe(DATE);
  });

  it("hata, çevrimdışı ya da tahmin ufku dışı → null", async () => {
    expect(await fetchWeather(SELCUK.loc, DATE, mock(() => json({ error: true, reason: "out of range" }, 400)).fn, NOW)).toBeNull();
    expect(await fetchWeather(SELCUK.loc, DATE, mock(() => json({ error: true, reason: "x" })).fn, NOW)).toBeNull();
    expect(
      await fetchWeather(
        SELCUK.loc,
        DATE,
        mock(() => {
          throw new TypeError("ağ yok");
        }).fn,
        NOW,
      ),
    ).toBeNull();
    expect(await fetchWeather(SELCUK.loc, DATE, mock(() => new Response("bozuk", { status: 200 })).fn, NOW)).toBeNull();
    const far = mock(() => json(body(new Array(24).fill(0))));
    expect(await fetchWeather(SELCUK.loc, "2026-11-20", far.fn, NOW)).toBeNull();
    expect(far.calls).toHaveLength(0);
    expect(await fetchWeather(SELCUK.loc, "27.10.2026", far.fn, NOW)).toBeNull();
  });
});
