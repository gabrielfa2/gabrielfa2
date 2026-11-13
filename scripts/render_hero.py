#!/usr/bin/env python3
"""
Render the gabrielfa2 hero card (first rectangle of the profile README) as an
animated SVG, modelled on AVIVASHISHTA29's hero card:

  paper background, mono badge, big serif name (second line italic with a
  sliding shine), sans tagline, and the ASCII portrait on the right.

Differences from the original:
  - badge reads "AI BUILDER"
  - name is "Gabriel Fah"
  - tagline is "I'm building the next generation of business software."
  - no site link
  - the portrait is our own terminal-window ASCII SVG (avi-ascii.svg),
    embedded inline so its own typing animation keeps running.

Fonts are the subset WOFFs from AVIVASHISHTA29/fonts (SIL OFL), embedded as
data URIs so the card works inside GitHub's <img> sandbox (no JS, no external
requests).

Run:  python3 scripts/render_hero.py
Out:  hero.svg
"""
import base64
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONTS = os.path.join(ROOT, "AVIVASHISHTA29", "fonts")
PORTRAIT = os.path.join(ROOT, "avi-ascii.svg")
OUT = os.path.join(ROOT, "hero.svg")

# ---- brand tokens (same palette as the original) -----------------------------
PAPER = "#f3f3f1"
INK = "#111111"
INK_SOFT = "#3a3a3c"
MUTED = "#6e6e73"
TECH = "#2f55ff"
W = 880   # full card width, GitHub's README column at 100%
H = 420

SERIF = "'Instrument Serif', Georgia, serif"
SANS = "Geist, system-ui, -apple-system, sans-serif"
MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

FONT_FILES = {
    "serif": ("Instrument Serif", "normal", 400, "serif-400.woff"),
    "serif-i": ("Instrument Serif", "italic", 400, "serif-italic.woff"),
    "sans": ("Geist", "normal", 400, "geist-400.woff"),
    "sans-b": ("Geist", "normal", 600, "geist-600.woff"),
    "mono": ("Geist Mono", "normal", 400, "geistmono-400.woff"),
}

BASE_CSS = """
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes nudgeup{0%,100%{transform:none}50%{transform:translate(3px,-3px)}}
.r{opacity:0;animation:rise .8s cubic-bezier(.2,.7,.2,1) both;transform-box:fill-box}
.f{opacity:0;animation:fade .9s ease-out both}
.nu{transform-box:fill-box;animation:nudgeup 1.8s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.r,.f,.nu{animation:none!important;opacity:1!important;transform:none!important}}
"""


def font_face(keys):
    out = []
    for k in keys:
        fam, style, weight, fn = FONT_FILES[k]
        b64 = base64.b64encode(open(os.path.join(FONTS, fn), "rb").read()).decode()
        out.append(
            f"@font-face{{font-family:'{fam}';font-style:{style};font-weight:{weight};"
            f"src:url(data:font/woff;base64,{b64}) format('woff')}}"
        )
    return "".join(out)


def d(s):  # animation delay attribute
    return f'style="animation-delay:{s:.2f}s"'


def hero():
    # our ASCII portrait is a standalone SVG (terminal window, 840x880) that
    # types itself in; embed the whole thing inline so its animation keeps
    # running inside the card.
    src = open(PORTRAIT).read()
    inner = re.sub(r"^<svg[^>]*>|</svg>\s*$", "", src.strip())
    ph, pw = 364, round(364 * 840 / 880)  # 348: fit the right half of the card
    px, py = W - pw - 44, (H - ph) // 2
    portrait = f'<svg x="{px}" y="{py}" width="{pw}" height="{ph}" viewBox="0 0 840 880">{inner}</svg>'

    body = f"""
<defs>
  <linearGradient id="shine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="600" y2="0">
    <stop offset="0" stop-color="{INK}"/><stop offset=".42" stop-color="{INK}"/>
    <stop offset=".5" stop-color="{TECH}"/><stop offset=".58" stop-color="{INK}"/>
    <stop offset="1" stop-color="{INK}"/>
    <animateTransform attributeName="gradientTransform" type="translate" values="-600 0;600 0;600 0"
      keyTimes="0;.45;1" dur="7s" begin="1.6s" repeatCount="indefinite"/>
  </linearGradient>
</defs>
<rect width="{W}" height="{H}" rx="14" fill="{PAPER}"/>
<g class="f" {d(0)}>
  <rect class="r" x="48" y="49" width="8" height="8" rx="2" fill="{TECH}"/>
  <text x="66" y="57" font-family="{MONO}" font-size="12" letter-spacing="1" fill="{MUTED}">AI BUILDER</text>
</g>
<text class="r" {d(0.15)} x="44" y="190" font-family="{SERIF}" font-size="116" letter-spacing="-2.5" fill="{INK}">Gabriel</text>
<text class="r" {d(0.3)} x="44" y="290" font-family="{SERIF}" font-style="italic" font-size="116" letter-spacing="-2.5" fill="url(#shine)">Fah</text>
<g class="r" {d(0.55)}>
  <text x="48" y="338" font-family="{SANS}" font-size="18" fill="{INK_SOFT}">I&#8217;m building the next generation</text>
  <text x="48" y="365" font-family="{SANS}" font-size="18" fill="{INK_SOFT}">of business software.</text>
</g>
{portrait}
"""
    css = font_face(["serif", "serif-i", "sans", "mono"]) + BASE_CSS
    if os.environ.get("STATIC"):  # preview: show every animation at its end state
        css += ".r,.f,.nu{animation:none!important;opacity:1!important;transform:none!important}"
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
        f'role="img" aria-label="Gabriel Fah. AI builder. I&#8217;m building the next generation of business software.">'
        f"<title>Gabriel Fah. AI builder. I&#8217;m building the next generation of business software.</title>"
        f"<style>{css}</style>{body}</svg>"
    )
    with open(OUT, "w") as f:
        f.write(svg)
    print(f"wrote {os.path.relpath(OUT, ROOT)} ({len(svg) // 1024} KB)")


if __name__ == "__main__":
    hero()
