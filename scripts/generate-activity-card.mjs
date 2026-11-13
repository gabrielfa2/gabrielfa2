#!/usr/bin/env node
// Renders the "last 12 months on GitHub" activity card as an animated SVG,
// modelled on AVIVASHISHTA29's activity() card (scripts/render_readme_cards.py):
//
//   paper background, mono eyebrow, big serif "N contributions" headline,
//   one bar per month (best month highlighted, current month greyed as
//   partial), and a side column with current streak, active days and the
//   busiest day.
//
// Same approach as generate-heatmap-card.mjs: data from fetch-contributions.mjs
// (public calendar + static extra contributions), fonts embedded as data URIs,
// CSS-only animation so it works inside GitHub's <img> sandbox.
//
// Run:  node scripts/generate-activity-card.mjs
// Out:  activity-card.svg
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extraContributions, fetchContributions } from "./fetch-contributions.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const FONTS = path.join(ROOT, "AVIVASHISHTA29", "fonts");
const OUT = path.join(ROOT, "activity-card.svg");

const PAPER = "#f3f3f1";
const INK = "#111111";
const MUTED = "#6e6e73";
const RULE = "#dcdcd7";
const PARTIAL = "#c9c9c4";
const LEARN = "#ffc81a"; // brand yellow, replaces the original's blue highlight
const YELLOW = "#e2a600"; // darker yellow for text on paper

const W = 880;
const H = 340;

const SERIF = "'Instrument Serif', Georgia, serif";
const SANS = "Geist, system-ui, -apple-system, sans-serif";
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const FONT_FILES = {
  serif: ["Instrument Serif", "normal", 400, "serif-400.woff"],
  "serif-i": ["Instrument Serif", "italic", 400, "serif-italic.woff"],
  sans: ["Geist", "normal", 400, "geist-400.woff"],
  mono: ["Geist Mono", "normal", 400, "geistmono-400.woff"],
};

async function fontFace(keys) {
  const faces = await Promise.all(
    keys.map(async (key) => {
      const [fam, style, weight, file] = FONT_FILES[key];
      const b64 = await readFile(path.join(FONTS, file), "base64");
      return `@font-face{font-family:'${fam}';font-style:${style};font-weight:${weight};src:url(data:font/woff;base64,${b64}) format('woff')}`;
    }),
  );
  return faces.join("");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const delay = (s) => `style="animation-delay:${s.toFixed(2)}s"`;

const { username, days, counts } = await fetchContributions();

// ---- per-day counts (GitHub + static extras), chronological -----------------
const daily = days
  .map((day) => ({
    date: day.date,
    count:
      (counts.get(`contribution-day-component-${day.weekday}-${day.week}`) ?? 0) +
      (extraContributions[day.date] ?? 0),
  }))
  .sort((a, b) => a.date.localeCompare(b.date));

const total = daily.reduce((sum, d) => sum + d.count, 0);
const activeDays = daily.filter((d) => d.count > 0).length;
const best = daily.reduce((a, b) => (b.count > a.count ? b : a));

// Current streak: today may not be over yet, so an empty last day doesn't break it.
let idx = daily.length - 1;
if (daily[idx].count === 0) idx--;
let currentStreak = 0;
while (idx >= 0 && daily[idx].count > 0) {
  currentStreak++;
  idx--;
}

let longestStreak = 0;
let run = 0;
for (const d of daily) {
  run = d.count > 0 ? run + 1 : 0;
  longestStreak = Math.max(longestStreak, run);
}

// ---- monthly totals, last 12 months ----------------------------------------
const byMonth = new Map();
for (const d of daily) {
  const key = d.date.slice(0, 7);
  byMonth.set(key, (byMonth.get(key) ?? 0) + d.count);
}
const monthly = [...byMonth].map(([month, t]) => ({ month, total: t })).slice(-12);

// Best month is picked among complete months (the last one is still in progress).
const pool = monthly.length > 1 ? monthly.slice(0, -1) : monthly;
const bestMonth = pool.reduce((a, b) => (b.total > a.total ? b : a));
const top = Math.max(bestMonth.total, 1);

// ---- bars -------------------------------------------------------------------
const X0 = 40;
const X1 = 600;
const BASE = 292;
const MAXH = 140;
const GAP = 10;
const bw = (X1 - X0 - GAP * (monthly.length - 1)) / monthly.length;

const bars = monthly
  .map((m, i) => {
    const partial = i === monthly.length - 1;
    const isBest = m === bestMonth;
    const bh = Math.max(4, Math.round((m.total / top) * MAXH));
    const x = X0 + i * (bw + GAP);
    const fill = isBest ? LEARN : partial ? PARTIAL : INK;
    const label = MONTHS[Number(m.month.slice(5, 7)) - 1];
    const d = 0.3 + i * 0.07;
    let out =
      `<rect class="g" ${delay(d)} x="${x.toFixed(1)}" y="${BASE - bh}" width="${bw.toFixed(1)}" height="${bh}" rx="4" fill="${fill}"><title>${label}: ${m.total.toLocaleString("en-US")}</title></rect>` +
      `<text class="f" ${delay(d)} x="${(x + bw / 2).toFixed(1)}" y="${BASE + 22}" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${MUTED}">${label}</text>`;
    if (isBest) {
      out += `<text class="p" ${delay(1.3)} x="${(x + bw / 2).toFixed(1)}" y="${BASE - bh - 10}" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${YELLOW}">${m.total.toLocaleString("en-US")}</text>`;
    }
    return out;
  })
  .join("");

// ---- side stats ---------------------------------------------------------------
const streakNote =
  currentStreak >= longestStreak ? "current streak, and the longest" : `current streak, longest ${longestStreak}`;
const stats = [
  [`${currentStreak} <tspan font-style="italic">${currentStreak === 1 ? "day" : "days"}</tspan>`, streakNote],
  [`${activeDays}<tspan fill="#8e8e93"> / ${daily.length}</tspan>`, "days with a commit"],
  [`${best.count}`, "on the busiest day"],
];
const side = stats
  .map(([big, small], i) => {
    const y = 104 + i * 92;
    let out =
      `<g class="r" ${delay(0.7 + i * 0.15)}>` +
      `<text x="650" y="${y}" font-family="${SERIF}" font-size="40" fill="${INK}">${big}</text>` +
      `<text x="650" y="${y + 24}" font-family="${SANS}" font-size="13" fill="${MUTED}">${small}</text></g>`;
    if (i < 2) out += `<rect class="f" ${delay(0.7)} x="650" y="${y + 44}" width="190" height="1" fill="${RULE}"/>`;
    return out;
  })
  .join("");

const css = await fontFace(["serif", "serif-i", "sans", "mono"]);
const totalStr = total.toLocaleString("en-US");

const body = `
<rect width="${W}" height="${H}" rx="14" fill="${PAPER}"/>
<text class="f" ${delay(0.1)} x="40" y="58" font-family="${MONO}" font-size="12" letter-spacing="1" fill="${MUTED}">THE LAST 12 MONTHS ON GITHUB</text>
<text class="r" ${delay(0.2)} x="38" y="114" font-family="${SERIF}" font-size="52" fill="${INK}">${totalStr} <tspan font-style="italic">contributions</tspan></text>
${bars}
${side}
`.trim();

const label = `${totalStr} contributions in the last year, ${currentStreak}-day streak`;
const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label} (${username})"><title>${label}</title><style>${css}@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@keyframes fade{from{opacity:0}to{opacity:1}}@keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}@keyframes pop{0%{opacity:0;transform:scale(.3)}70%{opacity:1;transform:scale(1.15)}100%{opacity:1;transform:none}}.r{opacity:0;animation:rise .8s cubic-bezier(.2,.7,.2,1) both;transform-box:fill-box}.f{opacity:0;animation:fade .9s ease-out both}.g{transform-box:fill-box;transform-origin:bottom;transform:scaleY(0);animation:grow .8s cubic-bezier(.2,.7,.2,1) both}.p{opacity:0;transform-box:fill-box;transform-origin:center;animation:pop .4s ease-out both}@media (prefers-reduced-motion: reduce){.r,.f,.g,.p{animation:none!important;opacity:1!important;transform:none!important}}</style>${body}</svg>
`;

await writeFile(OUT, svgOut);
console.log(
  `Wrote activity-card.svg (${totalStr} contributions, streak ${currentStreak}/${longestStreak}, ${activeDays}/${daily.length} active days, busiest ${best.count})`,
);
