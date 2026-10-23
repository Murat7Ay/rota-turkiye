// Hikâye kartı: 1080×1920 PNG (Instagram/WhatsApp hikâye boyutu). Sıcak kiremit → gün batımı
// degradesi, turkuaz deniz ışığı, krem paneller. Sistem yazı tipleri kullanılır; emojiler
// tuvale metin olarak basılır. Üst ve alt ~150 px, hikâye arayüzü için boş bırakılır.
import type { LonLat } from "@rota/core";
import type { DayStoryData, StoryPoint, StoryStat, StoryStopRow, WrappedStoryData } from "./storyData";

export const STORY_W = 1080;
export const STORY_H = 1920;

export type StoryKind = "day" | "wrapped";

export interface StoryRenderOptions {
  /** 1 = 1080×1920; önizleme için 0.5 gibi */
  scale?: number;
  type?: "image/png" | "image/jpeg" | "image/webp";
  quality?: number;
}

const C = {
  terra: "#C2410C",
  terraDeep: "#9A3412",
  turq: "#0E7490",
  cream: "#FFF7ED",
  ink: "#3B1F12",
  inkSoft: "rgba(59,31,18,0.62)",
  gold: "#D4A017",
};

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans"';
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';
const font = (weight: number, size: number) => `${weight} ${size}px ${SANS}, ${EMOJI}, sans-serif`;
const emojiFont = (size: number) => `${size}px ${EMOJI}, ${SANS}, sans-serif`;

const PAD_X = 72;
const CONTENT_BOTTOM = 1790;
const FOOTER_Y = 1852;
const FOOTER = "Rota Türkiye · harita © OpenStreetMap katkıcıları";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface Surface {
  ctx: Ctx;
  toBlob(type: string, quality?: number): Promise<Blob>;
}

function makeSurface(w: number, h: number): Surface {
  if (typeof OffscreenCanvas === "function") {
    try {
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext("2d");
      if (ctx) return { ctx, toBlob: (type, quality) => c.convertToBlob({ type, quality }) };
    } catch {
      // eski tarayıcı: normal tuvale düş
    }
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Tarayıcı tuval çizimini desteklemiyor.");
  return {
    ctx,
    toBlob: (type, quality) =>
      new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Görsel üretilemedi."))), type, quality)),
  };
}

// ---------------------------------------------------------------- küçük yardımcılar

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function spacing(ctx: Ctx, px: number) {
  if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

function noShadow(ctx: Ctx) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function ellipsize(ctx: Ctx, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(`${chars.slice(0, mid).join("")}…`).width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return `${chars.slice(0, lo).join("").trimEnd()}…`;
}

function wrap(ctx: Ctx, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (!cur || ctx.measureText(t).width <= maxW) cur = t;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = ellipsize(ctx, lines.slice(maxLines - 1).join(" "), maxW);
    return kept;
  }
  return lines.map((l) => ellipsize(ctx, l, maxW));
}

/** Deterministik küçük rastgele üreteç (doku noktaları için) */
function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function glow(ctx: Ctx, x: number, y: number, r: number, rgb: [number, number, number], a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`);
  g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
}

/** Sekiz köşeli yıldız (iki kare) — Selçuklu süslemelerini anımsatan motif */
function octagram(ctx: Ctx, cx: number, cy: number, R: number, stroke: string, lw: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? R : R * 0.7654;
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
    else ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- katmanlar

function drawBackground(ctx: Ctx, seed: number) {
  const g = ctx.createLinearGradient(0, 0, STORY_W * 0.35, STORY_H);
  g.addColorStop(0, "#7C2D12");
  g.addColorStop(0.3, C.terra);
  g.addColorStop(0.56, "#EA580C");
  g.addColorStop(0.8, C.terraDeep);
  g.addColorStop(1, C.turq);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  glow(ctx, STORY_W * 0.84, STORY_H * 0.15, 560, [253, 186, 116], 0.5); // güneş
  glow(ctx, STORY_W * 0.02, STORY_H, 920, [14, 116, 144], 0.9); // deniz
  glow(ctx, STORY_W, STORY_H * 0.76, 520, [34, 211, 238], 0.16);
  octagram(ctx, STORY_W - 140, 270, 200, "rgba(255,247,237,0.14)", 4);
  octagram(ctx, STORY_W - 140, 270, 128, "rgba(255,247,237,0.09)", 3);
  const rnd = lcg(seed);
  ctx.fillStyle = "rgba(255,247,237,0.05)";
  for (let i = 0; i < 1400; i++) ctx.fillRect(rnd() * STORY_W, rnd() * STORY_H, 2, 2);
}

function pill(ctx: Ctx, text: string, x: number, y: number, align: "left" | "right", style: "glass" | "solid") {
  ctx.font = font(800, 28);
  spacing(ctx, 4);
  const w = ctx.measureText(text).width + 56;
  const left = align === "left" ? x : x - w;
  rr(ctx, left, y, w, 60, 30);
  if (style === "glass") {
    ctx.fillStyle = "rgba(255,247,237,0.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,247,237,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.cream;
  } else {
    ctx.fillStyle = C.cream;
    ctx.fill();
    ctx.fillStyle = C.terra;
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + 28, y + 31);
  spacing(ctx, 0);
}

/** Başlık bloğu; içeriğin devam edeceği y'yi döndürür */
function drawHeader(ctx: Ctx, d: { kicker: string; title: string; subtitle: string; badge: string }): number {
  pill(ctx, "ROTA TÜRKİYE", PAD_X, 150, "left", "glass");
  pill(ctx, d.badge, STORY_W - PAD_X, 150, "right", "solid");
  const maxW = STORY_W - PAD_X * 2;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let y = 300;
  ctx.font = font(600, 36);
  ctx.fillStyle = "rgba(255,247,237,0.82)";
  ctx.fillText(ellipsize(ctx, d.kicker, maxW), PAD_X, y);

  ctx.font = font(800, 92);
  ctx.fillStyle = C.cream;
  ctx.shadowColor = "rgba(60,20,5,0.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 4;
  for (const line of wrap(ctx, d.title, maxW, 2)) {
    y += 100;
    ctx.fillText(line, PAD_X, y);
  }
  noShadow(ctx);

  y += 62;
  ctx.font = font(500, 40);
  ctx.fillStyle = "rgba(255,247,237,0.92)";
  ctx.fillText(ellipsize(ctx, d.subtitle, maxW), PAD_X, y);
  return y + 44;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawMap(ctx: Ctx, box: Box, lines: LonLat[][], points: StoryPoint[], opts: { emojiEvery: number }) {
  rr(ctx, box.x, box.y, box.w, box.h, 44);
  ctx.fillStyle = "rgba(40,14,4,0.30)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,247,237,0.24)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  rr(ctx, box.x, box.y, box.w, box.h, 44);
  ctx.clip();
  // ızgara
  ctx.strokeStyle = "rgba(255,247,237,0.06)";
  ctx.lineWidth = 2;
  for (let x = box.x + 60; x < box.x + box.w; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, box.y);
    ctx.lineTo(x, box.y + box.h);
    ctx.stroke();
  }
  for (let y = box.y + 60; y < box.y + box.h; y += 60) {
    ctx.beginPath();
    ctx.moveTo(box.x, y);
    ctx.lineTo(box.x + box.w, y);
    ctx.stroke();
  }

  const coords: LonLat[] = [...lines.flat(), ...points.map((p): LonLat => [p.loc.lon, p.loc.lat])].filter(
    ([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat),
  );
  if (coords.length === 0) {
    ctx.restore();
    return;
  }
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const MIN_SPAN = 0.012;
  if (maxLat - minLat < MIN_SPAN) {
    const c = (minLat + maxLat) / 2;
    minLat = c - MIN_SPAN / 2;
    maxLat = c + MIN_SPAN / 2;
  }
  if ((maxLon - minLon) * kx < MIN_SPAN) {
    const c = (minLon + maxLon) / 2;
    minLon = c - MIN_SPAN / kx / 2;
    maxLon = c + MIN_SPAN / kx / 2;
  }
  const pad = 84;
  const innerW = box.w - pad * 2;
  const innerH = box.h - pad * 2;
  const spanX = (maxLon - minLon) * kx;
  const spanY = maxLat - minLat;
  const s = Math.min(innerW / spanX, innerH / spanY);
  const ox = box.x + pad + (innerW - spanX * s) / 2;
  const oy = box.y + pad + (innerH - spanY * s) / 2;
  const proj = (lon: number, lat: number): [number, number] => [ox + (lon - minLon) * kx * s, oy + (maxLat - lat) * s];

  // rota: parlak krem dış çizgi + turkuaz iç çizgi
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const pass of [0, 1] as const) {
    for (const line of lines) {
      if (line.length < 2) continue;
      ctx.beginPath();
      line.forEach(([lon, lat], i) => {
        const [x, y] = proj(lon, lat);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (pass === 0) {
        ctx.shadowColor = "rgba(255,237,213,0.55)";
        ctx.shadowBlur = 26;
        ctx.strokeStyle = C.cream;
        ctx.lineWidth = 16;
      } else {
        noShadow(ctx);
        ctx.strokeStyle = C.turq;
        ctx.lineWidth = 7;
      }
      ctx.stroke();
    }
  }
  noShadow(ctx);

  // noktalar
  let plain = 0;
  for (const p of points) {
    const [x, y] = proj(p.loc.lon, p.loc.lat);
    if (p.kind === "start") {
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fillStyle = C.cream;
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = C.turq;
      ctx.stroke();
      continue;
    }
    if (p.kind === "end") {
      ctx.beginPath();
      ctx.arc(x, y, 32, 0, Math.PI * 2);
      ctx.fillStyle = C.cream;
      ctx.shadowColor = "rgba(40,14,4,0.35)";
      ctx.shadowBlur = 14;
      ctx.fill();
      noShadow(ctx);
      ctx.lineWidth = 5;
      ctx.strokeStyle = C.turq;
      ctx.stroke();
      ctx.font = emojiFont(34);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.emoji ?? "🏁", x, y + 2);
      continue;
    }
    if (p.n !== undefined) {
      ctx.beginPath();
      ctx.arc(x, y, 29, 0, Math.PI * 2);
      ctx.fillStyle = C.cream;
      ctx.shadowColor = "rgba(40,14,4,0.35)";
      ctx.shadowBlur = 14;
      ctx.fill();
      noShadow(ctx);
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.terra;
      ctx.stroke();
      ctx.font = font(800, 30);
      ctx.fillStyle = C.terra;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(p.n), x, y + 1);
      if (p.emoji) emojiBubble(ctx, x + 34, y - 34, p.emoji, 25);
      continue;
    }
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = C.cream;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.terra;
    ctx.stroke();
    if (p.emoji && plain % opts.emojiEvery === 0) emojiBubble(ctx, x + 26, y - 26, p.emoji, 22);
    plain++;
  }
  ctx.restore();
}

function emojiBubble(ctx: Ctx, x: number, y: number, emoji: string, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,247,237,0.94)";
  ctx.fill();
  ctx.font = emojiFont(Math.round(r * 1.25));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, x, y + 2);
}

function drawStats(ctx: Ctx, stats: StoryStat[], box: { x: number; y: number; w: number }, cols: number, tileH: number, gap: number): number {
  const rows = Math.ceil(stats.length / cols);
  const tileW = (box.w - gap * (cols - 1)) / cols;
  stats.forEach((st, i) => {
    const tx = box.x + (i % cols) * (tileW + gap);
    const ty = box.y + Math.floor(i / cols) * (tileH + gap);
    rr(ctx, tx, ty, tileW, tileH, 34);
    ctx.fillStyle = "rgba(255,247,237,0.95)";
    ctx.shadowColor = "rgba(40,14,4,0.25)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;
    ctx.fill();
    noShadow(ctx);
    let size = tileH >= 160 ? 80 : 66;
    ctx.font = font(800, size);
    while (size > 36 && ctx.measureText(st.value).width > tileW - 32) {
      size -= 4;
      ctx.font = font(800, size);
    }
    ctx.fillStyle = C.terra;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(st.value, tx + tileW / 2, ty + tileH * 0.58);
    ctx.font = font(600, 27);
    ctx.fillStyle = C.inkSoft;
    ctx.fillText(ellipsize(ctx, st.label, tileW - 24), tx + tileW / 2, ty + tileH * 0.84);
  });
  return box.y + rows * tileH + (rows - 1) * gap;
}

const LIST_PAD = 30;
const LIST_HEAD = 46;
const ROW_H = 62;

function listHeight(rows: number): number {
  return LIST_PAD * 2 + LIST_HEAD + Math.max(1, rows) * ROW_H;
}

function sectionLabel(ctx: Ctx, text: string, x: number, y: number) {
  ctx.font = font(800, 24);
  spacing(ctx, 3);
  ctx.fillStyle = C.terra;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
  spacing(ctx, 0);
}

function drawStopList(ctx: Ctx, rows: StoryStopRow[], box: Box) {
  rr(ctx, box.x, box.y, box.w, box.h, 40);
  ctx.fillStyle = "rgba(255,247,237,0.96)";
  ctx.fill();
  const x = box.x + LIST_PAD;
  sectionLabel(ctx, "GÜNÜN ROTASI", x, box.y + LIST_PAD + 22);
  const maxRows = Math.max(1, Math.floor((box.h - LIST_PAD * 2 - LIST_HEAD) / ROW_H));
  const shown = rows.length > maxRows ? rows.slice(0, maxRows - 1) : rows;
  const more = rows.length - shown.length;
  const innerW = box.w - LIST_PAD * 2;
  shown.forEach((r, i) => {
    const top = box.y + LIST_PAD + LIST_HEAD + i * ROW_H;
    const mid = top + ROW_H / 2;
    if (i > 0) {
      ctx.strokeStyle = "rgba(59,31,18,0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + innerW, top);
      ctx.stroke();
    }
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = font(700, 32);
    ctx.fillStyle = C.turq;
    ctx.fillText(r.time, x, mid);
    ctx.font = emojiFont(34);
    ctx.fillText(r.emoji, x + 110, mid + 2);
    ctx.font = font(600, 33);
    ctx.fillStyle = C.ink;
    const nameW = innerW - 168 - (r.done ? 56 : 0);
    ctx.fillText(ellipsize(ctx, r.name, nameW), x + 162, mid);
    if (r.done) {
      const cx = x + innerW - 20;
      ctx.beginPath();
      ctx.arc(cx, mid, 20, 0, Math.PI * 2);
      ctx.fillStyle = C.turq;
      ctx.fill();
      ctx.strokeStyle = C.cream;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 9, mid);
      ctx.lineTo(cx - 2, mid + 7);
      ctx.lineTo(cx + 10, mid - 7);
      ctx.stroke();
    }
  });
  if (rows.length === 0) {
    ctx.font = font(600, 32);
    ctx.fillStyle = C.inkSoft;
    ctx.textBaseline = "middle";
    ctx.fillText("Serbest gün: rota sende.", x, box.y + LIST_PAD + LIST_HEAD + ROW_H / 2);
  }
  if (more > 0) {
    const top = box.y + LIST_PAD + LIST_HEAD + shown.length * ROW_H;
    ctx.font = font(700, 30);
    ctx.fillStyle = C.inkSoft;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`+${more} durak daha`, x, top + ROW_H / 2);
  }
}

function drawFooter(ctx: Ctx) {
  ctx.font = font(500, 26);
  ctx.fillStyle = "rgba(255,247,237,0.86)";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(FOOTER, STORY_W / 2, FOOTER_Y);
}

// ---------------------------------------------------------------- kartlar

function drawDay(ctx: Ctx, d: DayStoryData) {
  drawBackground(ctx, hash(d.title + d.subtitle));
  const top = drawHeader(ctx, d);
  const w = STORY_W - PAD_X * 2 + 16;
  const x = PAD_X - 8;
  const statsH = 168;
  const gap = 32;
  // Liste ihtiyacı kadar yer alır; kalan harita için. Harita en az 420, en çok 760 px.
  const wantList = listHeight(d.stops.length);
  let mapH = CONTENT_BOTTOM - top - statsH - gap * 2 - wantList;
  mapH = Math.max(420, Math.min(760, mapH));
  drawMap(ctx, { x, y: top, w, h: mapH }, d.lines, d.points, { emojiEvery: 1 });
  const statsBottom = drawStats(ctx, d.stats, { x, y: top + mapH + gap, w }, 3, statsH, 22);
  const listTop = statsBottom + gap;
  drawStopList(ctx, d.stops, { x, y: listTop, w, h: Math.max(listHeight(1), CONTENT_BOTTOM - listTop) });
  drawFooter(ctx);
}

function drawWrapped(ctx: Ctx, d: WrappedStoryData) {
  drawBackground(ctx, hash(d.title + d.subtitle + "w"));
  const top = drawHeader(ctx, d);
  const w = STORY_W - PAD_X * 2 + 16;
  const x = PAD_X - 8;
  const gap = 28;
  const tileH = 132;
  const statsH = Math.ceil(d.stats.length / 3) * tileH + (Math.ceil(d.stats.length / 3) - 1) * 18;
  const stampsH = d.stampEmojis.length > 0 ? 100 : 0;

  // Manşet paneli: yazı boyutu, harita en az 300 px kalacak şekilde küçültülür
  const panelPad = 34;
  const innerW = w - panelPad * 2 - 44;
  let fs = 38;
  let laid: string[][] = [];
  let panelH = 0;
  for (; fs >= 28; fs -= 2) {
    ctx.font = font(700, fs);
    laid = d.headlines.map((h) => wrap(ctx, h, innerW, 3));
    const lineCount = laid.reduce((a, l) => a + l.length, 0);
    panelH = panelPad * 2 + 40 + lineCount * Math.round(fs * 1.3) + (laid.length - 1) * 18 + 56;
    const room = CONTENT_BOTTOM - top - statsH - stampsH - panelH - gap * (stampsH ? 3 : 2);
    if (room >= 300) break;
  }
  fs = Math.max(fs, 28);
  const mapH = Math.max(260, Math.min(620, CONTENT_BOTTOM - top - statsH - stampsH - panelH - gap * (stampsH ? 3 : 2)));
  const every = Math.max(1, Math.ceil(d.points.length / 10));
  drawMap(ctx, { x, y: top, w, h: mapH }, d.lines, d.points, { emojiEvery: every });
  let y = drawStats(ctx, d.stats, { x, y: top + mapH + gap, w }, 3, tileH, 18) + gap;

  if (stampsH) {
    // Yeni damgalar: altın halkalı küçük mühürler
    const r = 40;
    const n = d.stampEmojis.length;
    const step = r * 2 + 22;
    let cx = STORY_W / 2 - ((n - 1) * step) / 2;
    const cy = y + stampsH / 2 - 4;
    d.stampEmojis.forEach((e, i) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((i % 2 ? 1 : -1) * 8 * Math.PI) / 180);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = C.cream;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = C.gold;
      ctx.stroke();
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r - 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = emojiFont(38);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(e, 0, 2);
      ctx.restore();
      cx += step;
    });
    y += stampsH + gap;
  }

  // manşetler
  const panelTop = Math.max(y, CONTENT_BOTTOM - panelH);
  const ph = CONTENT_BOTTOM - panelTop;
  rr(ctx, x, panelTop, w, ph, 40);
  ctx.fillStyle = "rgba(255,247,237,0.96)";
  ctx.fill();
  const px = x + panelPad;
  sectionLabel(ctx, "MANŞETLER", px, panelTop + panelPad + 20);
  let ly = panelTop + panelPad + 40;
  const lh = Math.round(fs * 1.3);
  laid.forEach((lines, i) => {
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = C.terra;
    ctx.font = font(800, fs);
    ctx.fillText("✦", px, ly + lh / 2);
    ctx.font = font(i === 0 ? 800 : 700, fs);
    ctx.fillStyle = C.ink;
    for (const line of lines) {
      ctx.fillText(line, px + 44, ly + lh / 2);
      ly += lh;
    }
    ly += 18;
  });
  // para satırı
  ctx.strokeStyle = "rgba(59,31,18,0.1)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, panelTop + ph - panelPad - 44);
  ctx.lineTo(x + w - panelPad, panelTop + ph - panelPad - 44);
  ctx.stroke();
  ctx.font = font(600, 28);
  ctx.fillStyle = C.inkSoft;
  ctx.textBaseline = "middle";
  ctx.fillText(ellipsize(ctx, d.moneyLine, w - panelPad * 2), px, panelTop + ph - panelPad - 14);
  drawFooter(ctx);
}

/** Hikâye kartını çizer ve PNG Blob döndürür */
export function renderStoryCard(kind: "day", data: DayStoryData, opts?: StoryRenderOptions): Promise<Blob>;
export function renderStoryCard(kind: "wrapped", data: WrappedStoryData, opts?: StoryRenderOptions): Promise<Blob>;
export async function renderStoryCard(
  kind: StoryKind,
  data: DayStoryData | WrappedStoryData,
  opts: StoryRenderOptions = {},
): Promise<Blob> {
  const scale = opts.scale && opts.scale > 0 ? opts.scale : 1;
  const surface = makeSurface(Math.round(STORY_W * scale), Math.round(STORY_H * scale));
  const { ctx } = surface;
  ctx.scale(scale, scale);
  if (kind === "day") drawDay(ctx, data as DayStoryData);
  else drawWrapped(ctx, data as WrappedStoryData);
  return surface.toBlob(opts.type ?? "image/png", opts.quality);
}

/** İndirme/paylaşım dosya adı: "rota-turkiye-selcuk-pamukkale-1-gun.png" */
export function storyFileName(kind: StoryKind, title: string, badge?: string): string {
  const fold: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", İ: "i", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };
  const slug = (s: string) =>
    s
      .replace(/[çğıöşüİÇĞÖŞÜ]/g, (c) => fold[c] ?? c)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
  const parts = ["rota-turkiye", slug(title) || "gezi", kind === "wrapped" ? "wrapped" : slug(badge ?? "gun")].filter(Boolean);
  return `${parts.join("-")}.png`;
}
