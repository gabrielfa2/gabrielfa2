#!/usr/bin/env node
// Renders the "What I'm coding" section: a title and a single
// full-width project card for Dona, in the style of AVIVASHISHTA29's BUILD tile
// (tile() in scripts/render_readme_cards.py): yellow card, mono label, big serif
// name, tilt-in entrance, ring pulse and a sheen sweep.
//
// Dona is a private repo, so the card is not linked.
//
// Run:  node scripts/generate-coding-section.mjs
// Out:  title-coding-light.svg, dona-card.svg
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const FONTS = path.join(ROOT, "AVIVASHISHTA29", "fonts");

const INK = "#111111";
const LEARN = "#ffc81a"; // brand yellow
const W = 880;

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

const CSS = `
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes slidein{from{opacity:0;transform:translateX(-26px)}to{opacity:1;transform:none}}
@keyframes arrowin{0%{opacity:0;transform:translateX(-30px)}60%{opacity:1;transform:translateX(6px)}100%{opacity:1;transform:none}}
@keyframes nudge{0%,100%{transform:none}50%{transform:translateX(4px)}}
@keyframes tilein{0%{opacity:0;transform:translateY(90px) scale(.6) rotate(-9deg)}55%{opacity:1;transform:translateY(-10px) scale(1.05) rotate(2deg)}75%{transform:translateY(3px) scale(.98) rotate(-.8deg)}90%{transform:translateY(-1px) scale(1.01) rotate(.2deg)}100%{opacity:1;transform:none}}
@keyframes roll{from{transform:translateY(80px)}to{transform:none}}
@keyframes sheen{0%{transform:translateX(-260px) skewX(-20deg)}22%,100%{transform:translateX(960px) skewX(-20deg)}}
@keyframes ring{0%{opacity:.7;transform:scale(.2)}100%{opacity:0;transform:scale(2.4)}}
.r{opacity:0;animation:rise .8s cubic-bezier(.2,.7,.2,1) both;transform-box:fill-box}
.f{opacity:0;animation:fade .9s ease-out both}
.ti{opacity:0;transform-box:fill-box;transform-origin:50% 60%;animation:tilein 1.1s cubic-bezier(.2,.8,.2,1) both}
.sl{opacity:0;transform-box:fill-box;animation:slidein .6s cubic-bezier(.2,.7,.2,1) both}
.ai{opacity:0;transform-box:fill-box;animation:arrowin .7s cubic-bezier(.2,.7,.2,1) both}
.n{transform-box:fill-box;animation:nudge 1.8s ease-in-out infinite}
.ro{transform-box:fill-box;animation:roll .8s cubic-bezier(.15,.8,.2,1) both}
.sh{animation:sheen 5s ease-in-out infinite}
.rg{opacity:0;transform-box:fill-box;transform-origin:center;animation:ring 1s ease-out both}
@media (prefers-reduced-motion: reduce){.r,.f,.ti,.sl,.ai,.n,.ro,.rg{animation:none!important;opacity:1!important;transform:none!important}.sh,.rg{display:none}}
`.replace(/\n/g, "");

const delay = (s) => `style="animation-delay:${s.toFixed(2)}s"`;

async function writeSvg(file, w, h, body, fonts, label) {
  const css = (await fontFace(fonts)) + CSS;
  const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}"><title>${label}</title><style>${css}</style>${body}</svg>\n`;
  await writeFile(path.join(ROOT, file), out);
  console.log(`Wrote ${file}`);
}

// ---- Dona card ---------------------------------------------------------------
const H = 210;
const ON = INK; // dark text on yellow, like the LEARN tile
const card = `
<defs>
  <clipPath id="card"><rect width="${W}" height="${H}" rx="14"/></clipPath>
  <clipPath id="slot"><rect x="0" y="62" width="${W}" height="80"/></clipPath>
  <linearGradient id="gl" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<g class="ti" ${delay(0.2)}>
  <g clip-path="url(#card)">
    <rect width="${W}" height="${H}" fill="${LEARN}"/>
    <circle class="rg" ${delay(0.7)} cx="${W - 60}" cy="${H - 50}" r="70" fill="none" stroke="${ON}" stroke-opacity=".5" stroke-width="2"/>
    <rect class="sh" style="animation-delay:1.6s" x="0" y="-20" width="90" height="${H + 40}" fill="url(#gl)" transform="translate(-260 0)"/>
  </g>
  <text class="sl" ${delay(0.55)} x="32" y="42" font-family="${MONO}" font-size="12" letter-spacing="1.2" fill="${ON}">BUILDING NOW</text>
  <g class="ai" ${delay(0.7)}><text class="n" style="animation-delay:1.5s" x="${W - 40}" y="42" font-family="${MONO}" font-size="14" fill="${ON}">&#8594;</text></g>
  <g clip-path="url(#slot)"><g class="ro" ${delay(0.65)}>
    <text x="30" y="128" font-family="${SERIF}" font-style="italic" font-size="72" letter-spacing="-1" fill="${ON}">Dona</text>
  </g></g>
  <text class="r" ${delay(1.0)} x="32" y="176" font-family="${SANS}" font-size="14" fill="${ON}" opacity=".92">Private repo, in progress.</text>
</g>
`.trim();

await writeSvg("dona-card.svg", W, H, card, ["serif-i", "sans", "mono"], "Dona: what I'm building now");

// ---- section title (light + dark) --------------------------------------------
{
  const body = `<text class="r" ${delay(0.1)} x="2" y="46" font-family="${SERIF}" font-size="34" fill="${INK}">What I'm <tspan font-style="italic">coding</tspan></text>`;
  await writeSvg("title-coding-light.svg", W, 64, body, ["serif", "serif-i"], "What I'm coding");
}
