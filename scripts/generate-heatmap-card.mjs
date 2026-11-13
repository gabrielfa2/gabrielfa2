#!/usr/bin/env node
// Renders the "Isn't a sprint, it's a marathon" contribution card as an
// animated SVG, modelled on AVIVASHISHTA29's heatmap card (the heatmap()
// function in their scripts/render_readme_cards.py):
//
//   paper background, serif title with the accent words in yellow, mono
//   "REFRESHED DAILY" tag, and the contribution squares popping in column by
//   column with a less->more legend.
//
// Differences from the original:
//   - title reads "Isn't a sprint, it's a marathon" (sprint and marathon in
//     the LEARN yellow instead of "in blue" in blue)
//   - the squares use a yellow ramp instead of the blue one
//   - data comes from fetch-contributions.mjs (the same source as the
//     contribution calendar), including the static extra contributions
//
// Fonts are the subset WOFFs from AVIVASHISHTA29/fonts (SIL OFL), embedded as
// data URIs so the card works inside GitHub's <img> sandbox (no JS, no
// external requests).
//
// Run:  node scripts/generate-heatmap-card.mjs
// Out:  heatmap-card.svg
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extraContributions, fetchContributions } from "./fetch-contributions.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const FONTS = path.join(ROOT, "AVIVASHISHTA29", "fonts");
const OUT = path.join(ROOT, "heatmap-card.svg");

// ---- brand tokens (same palette as the original, accent swapped to yellow) --
const PAPER = "#f3f3f1";
const PAPER_DEEP = "#e2e2de";
const INK = "#111111";
const MUTED = "#6e6e73";
const YELLOW = "#e2a600"; // title accent, readable on paper
const LEARN = "#ffc81a"; // the brand yellow used across the profile

const W = 880; // full card width, GitHub's README column at 100%

// Yellow ramp replacing the original blue one: empty -> brightest.
const RAMP = [PAPER_DEEP, "#ffe9a8", "#ffd76b", "#ffca3d", LEARN, YELLOW];

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const FONT_FILES = {
  serif: ["Instrument Serif", "normal", 400, "serif-400.woff"],
  "serif-i": ["Instrument Serif", "italic", 400, "serif-italic.woff"],
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

// Same level thresholds as the original card.
function levelFor(count) {
  return count === 0 ? 0 : count <= 5 ? 1 : count <= 15 ? 2 : count <= 30 ? 3 : count <= 50 ? 4 : 5;
}

const { username, days, counts } = await fetchContributions();

const CELL = 12;
const STEP = 15;
const GX = 44;
const GY = 96;

// Rebuild the week grid from the parsed calendar, Sunday = row 0.
const weeks = [];
for (const day of days) {
  (weeks[day.week] ??= [])[day.weekday] = day;
}
const ncols = weeks.length;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const cells = [];
const months = [];
const seen = new Set();
for (let week = 0; week < ncols; week++) {
  for (let weekday = 0; weekday < 7; weekday++) {
    const day = weeks[week]?.[weekday];
    if (!day) continue;

    const month = Number(day.date.slice(5, 7)) - 1;
    if (day.date.endsWith("-01") && !seen.has(month)) {
      seen.add(month);
      months.push([week, MONTHS[month]]);
    }

    const githubCount = counts.get(`contribution-day-component-${weekday}-${week}`) ?? 0;
    const count = githubCount + (extraContributions[day.date] ?? 0);
    // Squares pop in column by column, left to right, like the original.
    const delay = (1.0 + week * 0.03 + weekday * 0.02).toFixed(2);
    cells.push(
      `<rect class="p" style="animation-delay:${delay}s" x="${GX + week * STEP}" y="${GY + weekday * STEP}" `
        + `width="${CELL}" height="${CELL}" rx="3" fill="${RAMP[levelFor(count)]}">`
        + `<title>${count} contribution${count === 1 ? "" : "s"} on ${day.date}</title></rect>`,
    );
  }
}

const right = GX + ncols * STEP - 3;
const labelsY = GY + 7 * STEP + 16;
const monthLabels = months
  .filter(([week]) => week < ncols - 12)
  .map(([week, m]) => `<text x="${GX + week * STEP}" y="${labelsY}" font-family="${MONO}" font-size="11" fill="${MUTED}">${m}</text>`)
  .join("");

const legendX = right - RAMP.length * 14;
const legend = RAMP.map(
  (color, i) =>
    `<rect x="${legendX + i * 14}" y="${GY + 7 * STEP + 6}" width="11" height="11" rx="2.5" fill="${color}"/>`,
).join("");

const h = GY + 7 * STEP + 44;

const total =
  Object.values(extraContributions).reduce((sum, n) => sum + n, 0) +
  [...counts.values()].reduce((sum, n) => sum + n, 0);

const css = await fontFace(["serif", "serif-i", "mono"]);

const body = `
<rect width="${W}" height="${h}" rx="14" fill="${PAPER}"/>
<text class="r" style="animation-delay:0.80s" x="42" y="62" font-family="${SERIF}" font-size="34" fill="${INK}">Isn't a <tspan font-style="italic" fill="${YELLOW}">sprint</tspan>, it's a <tspan font-style="italic" fill="${YELLOW}">marathon</tspan></text>
<text class="f" style="animation-delay:0.80s" x="${right}" y="60" text-anchor="end" font-family="${MONO}" font-size="12" letter-spacing="1" fill="${MUTED}">REFRESHED DAILY</text>
${cells.join("\n")}
<g class="f" style="animation-delay:2.40s">${monthLabels}
<text x="${legendX - 8}" y="${labelsY}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${MUTED}">less</text>
${legend}
<text x="${legendX + RAMP.length * 14 + 2}" y="${labelsY}" font-family="${MONO}" font-size="11" fill="${MUTED}">more</text></g>
`.trim();

const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-label="Contribution graph for ${username}: isn't a sprint, it's a marathon. ${total} contributions in the last year"><title>Contribution graph: ${total} contributions in the last year</title><style>${css}@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@keyframes fade{from{opacity:0}to{opacity:1}}@keyframes pop{0%{opacity:0;transform:scale(.3)}70%{opacity:1;transform:scale(1.15)}100%{opacity:1;transform:none}}.r{opacity:0;animation:rise .8s cubic-bezier(.2,.7,.2,1) both;transform-box:fill-box}.f{opacity:0;animation:fade .9s ease-out both}.p{opacity:0;transform-box:fill-box;transform-origin:center;animation:pop .4s ease-out both}@media (prefers-reduced-motion: reduce){.r,.f,.p{animation:none!important;opacity:1!important;transform:none!important}}</style>${body}</svg>
`;

await writeFile(OUT, svgOut);
console.log(`Wrote heatmap-card.svg (${days.length} days, ${ncols} weeks, ${total} contributions)`);
