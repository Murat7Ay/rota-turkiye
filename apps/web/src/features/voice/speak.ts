// Sesli rehber metinleri: brifingi, yakınlık bildirimini ve "Şimdi ne yapsam?" önerilerini
// doğal Türkçe cümlelere çevirir. Sayılar ve saatler okunuşa çevrilir ("12:30'da" → "on iki otuzda");
// böylece hangi TTS motoru olursa olsun aynı şekilde okunur. Ağ gerektirmez.
import { CATEGORIES, type Briefing, type ProximityNotification, type Slot } from "@rota/core";
import type { NowSuggestion } from "../../../../../packages/core/src/now";
import { placeWithCase, trCaseSuffix, type GoldenHourSpot, type TrCase } from "../../../../../packages/core/src/sun";

// ---------------------------------------------------------------- sayılar

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"] as const;
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"] as const;
const VOWELS = "aeıioöuü";

function under1000(n: number): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  if (h) out.push(...(h === 1 ? ["yüz"] : [ONES[h]!, "yüz"]));
  if (t) out.push(TENS[t]!);
  if (o) out.push(ONES[o]!);
  return out;
}

/** 0 → "sıfır", 12 → "on iki", 1905 → "bin dokuz yüz beş", 2400 → "iki bin dört yüz" (999.999'a kadar) */
export function numberToWordsTr(n: number): string {
  if (!Number.isFinite(n)) return "";
  const x = Math.round(Math.abs(n));
  if (x === 0) return "sıfır";
  if (x >= 1_000_000) return String(x);
  const th = Math.floor(x / 1000);
  const parts = [...(th === 0 ? [] : th === 1 ? ["bin"] : [...under1000(th), "bin"]), ...under1000(x % 1000)];
  return `${n < 0 ? "eksi " : ""}${parts.join(" ")}`;
}

/** 2.5 → "iki buçuk", 2.3 → "iki virgül üç" */
export function decimalToWordsTr(x: number, digits = 1): string {
  const f = 10 ** digits;
  const r = Math.round(Math.abs(x) * f) / f;
  const int = Math.trunc(r);
  const frac = Math.round((r - int) * f);
  const sign = x < 0 ? "eksi " : "";
  if (frac === 0) return sign + numberToWordsTr(int);
  if (frac * 2 === f) return `${sign}${numberToWordsTr(int)} buçuk`;
  return `${sign}${numberToWordsTr(int)} virgül ${numberToWordsTr(frac)}`;
}

function lastVowel(word: string): string {
  for (let i = word.length - 1; i >= 0; i--) if (VOWELS.includes(word[i]!)) return word[i]!;
  return "e";
}

/** Dört yollu ünlü uyumu: ı / i / u / ü */
function harmony4(word: string): string {
  const v = lastVowel(word);
  return "aı".includes(v) ? "ı" : "ei".includes(v) ? "i" : "ou".includes(v) ? "u" : "ü";
}

/** 3 → "üçüncü", 4 → "dördüncü", 21 → "yirmi birinci" */
export function ordinalTr(n: number): string {
  const words = numberToWordsTr(n).split(" ");
  let last = words.pop() ?? "";
  if (last === "dört") last = "dörd";
  const h = harmony4(last);
  const ord = VOWELS.includes(last[last.length - 1]!) ? `${last}nc${h}` : `${last}${h}nc${h}`;
  return [...words, ord].join(" ");
}

/** "birinci" → "birincisi", "üçüncü" → "üçüncüsü" */
function possessive3(word: string): string {
  return `${word}${VOWELS.includes(word[word.length - 1]!) ? "s" : ""}${harmony4(word)}`;
}

/** Kelimeye hâl eki (konuşma dili: dört → dörde) */
function inflect(word: string, c: TrCase): string {
  if (c === "e" && word === "dört") return "dörde";
  return word + trCaseSuffix(word, c);
}

function inflectPhrase(phrase: string, c: TrCase): string {
  const parts = phrase.split(" ");
  const last = parts.pop() ?? "";
  return [...parts, inflect(last, c)].join(" ");
}

/** 750 → "on iki otuz"; c verilirse son kelimeye ek: "on iki otuzda", "dokuza", "on yediden" */
export function timeToWordsTr(min: number, c?: TrCase): string {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  if (h === 0 && m === 0) return c ? `gece yarısı${c === "e" ? "na" : c === "de" ? "nda" : "ndan"}` : "gece yarısı";
  const words = [h === 0 ? "sıfır" : numberToWordsTr(h)];
  if (m > 0 && m < 10) words.push("sıfır", ONES[m]!);
  else if (m >= 10) words.push(numberToWordsTr(m));
  const phrase = words.join(" ");
  return c ? inflectPhrase(phrase, c) : phrase;
}

/** 45 → "kırk beş dakika", 90 → "bir buçuk saat", 130 → "iki saat on dakika" */
export function durationToWordsTr(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m === 30) return "yarım saat";
  if (m < 60) return `${numberToWordsTr(m)} dakika`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (r === 0) return `${numberToWordsTr(h)} saat`;
  if (r === 30) return `${numberToWordsTr(h)} buçuk saat`;
  return `${numberToWordsTr(h)} saat ${numberToWordsTr(r)} dakika`;
}

/** 0.4 → "dört yüz metre", 2.3 → "iki buçuk kilometre", 187 → "yüz doksan kilometre" */
export function distanceToWordsTr(km: number): string {
  if (km < 0.975) return `${numberToWordsTr(Math.max(50, Math.round((km * 1000) / 50) * 50))} metre`;
  if (km < 10) {
    const half = Math.round(km * 2) / 2;
    const int = Math.trunc(half);
    return `${numberToWordsTr(int)}${half > int ? " buçuk" : ""} kilometre`;
  }
  return `${numberToWordsTr(km >= 100 ? Math.round(km / 10) * 10 : Math.round(km))} kilometre`;
}

export function moneyToWordsTr(amountTry: number): string {
  return `${numberToWordsTr(Math.round(amountTry))} lira`;
}

// ---------------------------------------------------------------- serbest metin → konuşma

/** "1.200" → 1200, "2,5" → 2.5 */
function parseTrNumber(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

function caseOf(suffix: string | undefined): TrCase | null {
  if (!suffix) return null;
  const s = suffix.toLocaleLowerCase("tr");
  if (/^y?[ae]$/.test(s)) return "e";
  if (/^[dt][ae]$/.test(s)) return "de";
  if (/^[dt][ae]n$/.test(s)) return "den";
  return null;
}

function cap(s: string): string {
  if (!s) return s;
  const f = s[0]!;
  return (f === "i" ? "İ" : f === "ı" ? "I" : f.toLocaleUpperCase("tr")) + s.slice(1);
}

function cleanName(name: string): string {
  return name.replace(/\s*\(test\)/gi, "").trim();
}

const END = "(?=$|[\\s,.;:!?)·—–])";
const re = (src: string, flags = "g") => new RegExp(src, flags);

/**
 * Arayüz metnini okunur hâle getirir: saatler, sayılar, birimler, para ve simgeler.
 * "~2 sa 10 dk yolda · 15:00'ten sonra yağmur" → "yaklaşık iki saat on dakika yolda, on beşten sonra yağmur"
 */
export function normalizeForSpeech(text: string): string {
  let s = text
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/\s*\(test\)/gi, "")
    .replace(/~\s*/g, "yaklaşık ");

  // Sıcaklık ve yüzde
  s = s.replace(/(-?\d+)\s*[–-]\s*(-?\d+)\s*°C?/g, (_, a: string, b: string) => `${numberToWordsTr(+a)} ile ${numberToWordsTr(+b)} derece`);
  s = s.replace(/(-?\d+)\s*°C?/g, (_, a: string) => `${numberToWordsTr(+a)} derece`);
  s = s.replace(/%\s?(\d+)|(\d+)\s?%/g, (_, a?: string, b?: string) => `yüzde ${numberToWordsTr(Number(a ?? b))}`);

  // Saat aralıkları ve ekli saatler
  s = s.replace(
    /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/g,
    (_, h1: string, m1: string, h2: string, m2: string) => `${timeToWordsTr(+h1 * 60 + +m1)} ile ${timeToWordsTr(+h2 * 60 + +m2)}`,
  );
  s = s.replace(/(\d{1,2}):(\d{2})(?:'([a-zçğıöşü]+))?/gi, (_, h: string, m: string, suf?: string) => {
    const c = caseOf(suf);
    return timeToWordsTr(+h * 60 + +m, c ?? undefined);
  });

  // Para
  s = s.replace(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?\s*(?:TL|₺)/g, (_, a: string) => moneyToWordsTr(parseTrNumber(a)));

  // Süre ve mesafe
  s = s.replace(re(`(\\d+)\\s*sa\\s+(\\d+)\\s*dk${END}`), (_, h: string, m: string) => durationToWordsTr(+h * 60 + +m));
  s = s.replace(re(`(\\d+)\\s*sa${END}`), (_, h: string) => `${numberToWordsTr(+h)} saat`);
  s = s.replace(re(`(\\d+)\\s*dk${END}`), (_, m: string) => `${numberToWordsTr(+m)} dakika`);
  s = s.replace(re(`(\\d{1,3}(?:\\.\\d{3})+|\\d+(?:,\\d+)?)\\s*km${END}`), (_, k: string) => distanceToWordsTr(parseTrNumber(k)));
  s = s.replace(re(`(\\d+)\\s?m${END}`), (_, m: string) => `${numberToWordsTr(+m)} metre`);

  // Sıra sayısı ("3. gün"), ekli sayı ("3'ten") ve kalan sayılar
  s = s.replace(/(\d+)\.\s(?=[a-zçğıöşü])/g, (_, n: string) => `${ordinalTr(+n)} `);
  s = s.replace(/(\d+)'([a-zçğıöşü]+)/gi, (_, n: string, suf: string) => {
    const c = caseOf(suf);
    const w = numberToWordsTr(+n);
    return c ? inflectPhrase(w, c) : w;
  });
  s = s.replace(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g, (m) =>
    m.includes(",") ? decimalToWordsTr(parseTrNumber(m), 2) : numberToWordsTr(parseTrNumber(m)),
  );

  // Simgeler
  s = s
    .replace(/\s*[→·—–]\s*/g, ", ")
    .replace(/\s*\/\s*/g, " ya da ")
    .replace(/\s*[+&]\s*/g, " ve ")
    .replace(/\s*\(\s*/g, ", ")
    .replace(/\s*\)/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])(\s*[,;:])+/g, "$1")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[,;:]\s*/, "");
  return s;
}

function sentence(s: string): string {
  const t = s.trim().replace(/[,;:]\s*$/, "");
  if (!t) return "";
  return /[.!?…]$/.test(t) ? cap(t) : `${cap(t)}.`;
}

// ---------------------------------------------------------------- brifing

const SLOT_SPEECH: Record<Slot, string> = {
  kahvalti: "kahvaltı",
  ogle: "öğle yemeği",
  aksam: "akşam yemeği",
  cay: "çay molası",
  tatli: "tatlı molası",
  alisveris: "alışveriş",
  gezi: "gezi",
  konaklama: "konaklama",
};

/** "2 sa 10 dk" → 130 */
function parseDuration(s: string): number | null {
  const m = /^(?:(\d+) sa)?\s*(?:(\d+) dk)?$/.exec(s.trim());
  if (!m || (!m[1] && !m[2])) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

/** "Selçuk'ta" + biz: "Selçuk'tayız", "İzmir'deyiz" */
function locativeWe(name: string): string | null {
  const loc = placeWithCase(cleanName(name), "de");
  if (!loc) return null;
  return `${loc}${loc.endsWith("a") ? "yız" : "yiz"}`;
}

/**
 * Sabah brifingini doğal konuşmaya çevirir:
 * "Günaydın! Bugün üçüncü gün. Selçuk'tan Pamukkale'ye gidiyoruz, yaklaşık yüz doksan kilometre. …"
 */
export function briefingToSpeech(b: Briefing, opts: { maxItems?: number } = {}): string {
  const out: string[] = [];
  const t = /^Günaydın!\s*(\d+)\.\s*gün:\s*(.+)$/.exec(b.title);
  const n = t ? Number(t[1]) : b.dayIndex + 1;
  out.push(`Günaydın! Bugün ${ordinalTr(n)} gün.`);

  let route = t?.[2] ?? "";
  let km: number | null = null;
  const kmMatch = /\s*·\s*~?([\d.,]+)\s*km$/.exec(route);
  if (kmMatch) {
    km = parseTrNumber(kmMatch[1]!);
    route = route.slice(0, kmMatch.index);
  }
  const ends = route.split(/\s*→\s*/);
  const travel = ends.length === 2;
  if (travel) {
    const from = placeWithCase(cleanName(ends[0]!), "den");
    const to = placeWithCase(cleanName(ends[1]!), "e");
    const dist = km !== null ? `, yaklaşık ${distanceToWordsTr(km)}` : "";
    out.push(
      from && to
        ? `${from} ${to} gidiyoruz${dist}.`
        : sentence(`Rota: ${normalizeForSpeech(ends[0]!)}, sonra ${normalizeForSpeech(ends[1]!)}${dist}`),
    );
  } else if (route) {
    const we = locativeWe(route);
    out.push(we ? `Bugün ${we}.` : sentence(`Bugün ${normalizeForSpeech(route)} çevresindeyiz`));
  } else if (!t) {
    out.push(sentence(normalizeForSpeech(b.title)));
  }

  for (const line of b.summary) {
    const first = /^İlk çıkış (\d{1,2}):(\d{2})$/.exec(line);
    if (first) {
      out.push(`İlk çıkış saat ${timeToWordsTr(Number(first[1]) * 60 + Number(first[2]), "de")}.`);
      continue;
    }
    const total = /^Toplam ~?([\d.,]+) km(?: · ~?(.+) (yolda|yürüyüş))?$/.exec(line);
    if (total) {
      const dur = total[2] ? parseDuration(total[2]) : null;
      const kmT = parseTrNumber(total[1]!);
      if (total[3] === "yürüyüş") {
        out.push(`Toplam yaklaşık ${distanceToWordsTr(kmT)} yürüyüş${dur ? `, ${durationToWordsTr(dur)} kadar` : ""}.`);
      } else if (dur) {
        out.push(km !== null ? `Yaklaşık ${durationToWordsTr(dur)} yoldayız.` : `Toplam yaklaşık ${distanceToWordsTr(kmT)}, ${durationToWordsTr(dur)} yoldayız.`);
      } else if (km === null) out.push(`Toplam yaklaşık ${distanceToWordsTr(kmT)} yol var.`);
      continue;
    }
    const weather = /^(.+),\s*(-?\d+)–(-?\d+)°C$/.exec(line);
    if (weather) {
      out.push(
        `Hava ${weather[1]!.toLocaleLowerCase("tr")}, sıcaklık ${numberToWordsTr(Number(weather[2]))} ile ${numberToWordsTr(Number(weather[3]))} derece arasında.`,
      );
      continue;
    }
    const stops = /^(\d+) durak(?: \((\d+) gezi\))?$/.exec(line);
    if (stops) {
      const g = stops[2] ? Number(stops[2]) : 0;
      out.push(`Bugün ${numberToWordsTr(Number(stops[1]))} durak var${g ? `, ${numberToWordsTr(g)} tanesi gezi` : ""}.`);
      continue;
    }
    out.push(sentence(normalizeForSpeech(line)));
  }

  const max = opts.maxItems ?? 6;
  const items = b.items.slice(0, max);
  if (items.length) out.push("Plan şöyle:");
  for (const it of items) {
    const name = normalizeForSpeech(cleanName(it.placeName));
    if (it.slot === "konaklama") {
      out.push(`Gece konaklama: ${name}.`);
      continue;
    }
    const tm = /^(\d{1,2}):(\d{2})$/.exec(it.time);
    const when = tm ? `${cap(timeToWordsTr(Number(tm[1]) * 60 + Number(tm[2]), "de"))} ` : "";
    out.push(sentence(`${when}${when ? SLOT_SPEECH[it.slot] : cap(SLOT_SPEECH[it.slot])}: ${name}`));
  }
  if (b.items.length > max) out.push(`Ve ${numberToWordsTr(b.items.length - max)} durak daha.`);

  b.warnings.slice(0, 2).forEach((w, i) => out.push(sentence(`${i === 0 ? "Dikkat: " : ""}${normalizeForSpeech(w)}`)));
  if (b.budgetLine) out.push(sentence(normalizeForSpeech(b.budgetLine)));
  if (b.planB) out.push(sentence(normalizeForSpeech(b.planB)));
  out.push(travel ? "İyi yolculuklar!" : "Keyifli bir gün!");
  return out.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------- yakınlık bildirimi

/**
 * "İleride, on iki kilometre sonra Nysa Antik Kenti var. Rotadan altı dakikalık sapma.
 *  Uğramak ister misin?"
 */
export function notificationToSpeech(n: ProximityNotification): string {
  const d = n.discovery;
  const name = normalizeForSpeech(cleanName(d.place.name));
  const ahead = n.title.startsWith("İleride");
  const parts = n.body.split(" · ");
  const kmMatch = /^([\d.,]+) km (sonra|uzakta)/.exec(n.body);
  const km = kmMatch ? parseTrNumber(kmMatch[1]!) : null;
  const highlight = parts.length > 1 ? parts[parts.length - 1]! : "";
  const out: string[] = [];
  if (ahead) {
    out.push(km !== null ? `İleride, ${distanceToWordsTr(km)} sonra ${name} var.` : `İleride ${name} var.`);
  } else {
    out.push(km !== null ? `Yakınında, ${distanceToWordsTr(km)} ötede ${name} var.` : `Yakınında ${name} var.`);
  }
  if (highlight && !/km|dk/.test(highlight) && highlight !== CATEGORIES[d.place.cat].label) out.push(sentence(normalizeForSpeech(highlight)));
  if (ahead) {
    out.push(
      d.offRouteKm < 0.25
        ? "Tam rotanın üzerinde."
        : `Rotadan ${numberToWordsTr(Math.max(1, Math.round(d.detourMin)))} dakikalık sapma.`,
    );
  } else {
    out.push(`Gidişi yaklaşık ${durationToWordsTr(Math.max(1, Math.round(d.detourMin / 2)))}.`);
  }
  out.push("Uğramak ister misin?");
  return out.join(" ");
}

// ---------------------------------------------------------------- "Şimdi ne yapsam?" ve gün batımı

export function nowSuggestionsToSpeech(list: readonly NowSuggestion[]): string {
  if (list.length === 0) return "Şu an yakında açık ve uygun bir yer bulamadım. Biraz sonra yeniden sor.";
  const out = [list.length === 1 ? "Bir önerim var." : `${cap(numberToWordsTr(list.length))} önerim var.`];
  list.forEach((s, i) => {
    const title = normalizeForSpeech(s.title).replace(/:\s*/g, ", ");
    out.push(sentence(`${cap(possessive3(ordinalTr(i + 1)))}: ${title}`));
    out.push(sentence(normalizeForSpeech(s.subtitle)));
  });
  return out.join(" ");
}

export function goldenHourToSpeech(spotOrLine: GoldenHourSpot | string): string {
  const line = typeof spotOrLine === "string" ? spotOrLine : spotOrLine.line;
  return sentence(normalizeForSpeech(line));
}
