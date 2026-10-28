#!/usr/bin/env node
// Wraps yellow.gif in an SVG so the banner can animate into view.
// GitHub strips CSS from README markdown, but CSS inside an SVG still runs
// when the SVG is displayed with <img>. The GIF is embedded as a data URI
// because SVG images loaded through <img> cannot fetch external resources.
import { readFile, writeFile } from "node:fs/promises";

const gif = await readFile(new URL("../yellow.gif", import.meta.url));
const dataUri = `data:image/gif;base64,${gif.toString("base64")}`;
const width = 800;
const height = 450;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Pixel art autumn landscape">
  <style>
    .banner {
      animation: banner-in 800ms cubic-bezier(0.22, 1, 0.36, 1) 80ms backwards;
      transform-box: fill-box;
      transform-origin: center;
    }
    @keyframes banner-in {
      from { opacity: 0; transform: translateY(14px) scale(1.02); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .banner { animation: none; }
    }
  </style>
  <g class="banner">
    <image href="${dataUri}" width="${width}" height="${height}"/>
  </g>
</svg>
`;

await writeFile(new URL("../yellow.svg", import.meta.url), svg);
console.log(`Wrote yellow.svg (${width}x${height}, ${(svg.length / 1024).toFixed(0)} KiB)`);
