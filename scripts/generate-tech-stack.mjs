#!/usr/bin/env node
// Generates tech-stack.svg, the icon grid shown next to the banner in README.md.
// Icons come from Simple Icons. Edit ICONS, then run:
//   node scripts/generate-tech-stack.mjs
// Bump the ?v= query on tech-stack.svg in README.md so GitHub refreshes its cache.
import { writeFile } from "node:fs/promises";

const ICONS = [
  { slug: "react", title: "React", color: "#61dafb" },
  { slug: "nextdotjs", title: "Next.js", color: "#000000" },
  { slug: "typescript", title: "TypeScript", color: "#3178c6" },
  { slug: "javascript", title: "JavaScript", color: "#f7df1e" },
  { slug: "nodedotjs", title: "Node.js", color: "#5fa04e" },
  { slug: "postgresql", title: "PostgreSQL", color: "#4169e1" },
  { slug: "supabase", title: "Supabase", color: "#3fcf8e" },
  { slug: "tailwindcss", title: "Tailwind CSS", color: "#06b6d4" },
  { slug: "html5", title: "HTML5", color: "#e34f26" },
  { slug: "css", title: "CSS", color: "#663399" },
  { slug: "git", title: "Git", color: "#f03c2e" },
  { slug: "github", title: "GitHub", color: "#181717" },
  { slug: "docker", title: "Docker", color: "#2496ed" },
  { slug: "cloudflare", title: "Cloudflare", color: "#f38020" },
  { slug: "vercel", title: "Vercel", color: "#000000" },
];

const COLUMNS = 4;
const ICON_SIZE = 52;
const GAP = 16;
const PADDING = 12;
const ROWS = Math.ceil(ICONS.length / COLUMNS);
const GRID_WIDTH = COLUMNS * ICON_SIZE + (COLUMNS - 1) * GAP;
const WIDTH = GRID_WIDTH + PADDING * 2;
const HEIGHT = ROWS * ICON_SIZE + (ROWS - 1) * GAP + PADDING * 2;

// Logos that would disappear against one of GitHub's themes.
// Add an entry here if you add an icon whose brand color is black or very dark.
const DARK_COLORS = {
  nextdotjs: "#f0f6fc",
  github: "#f0f6fc",
  vercel: "#f0f6fc",
  css: "#a78bfa",
};
const LIGHT_COLORS = {
  css: "#663399",
};

async function fetchIcon(icon) {
  const url = `https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/${icon.slug}.svg`;
  const response = await fetch(url, {
    headers: { "User-Agent": "gabrielfa2-profile-readme" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${icon.slug}: ${response.status} ${response.statusText}`);
  }
  const svg = await response.text();
  const pathTag = svg.match(/<path\b([^>]*?)\/?>/)?.[1] ?? "";
  const d = pathTag.match(/\bd="([^"]+)"/)?.[1];
  if (!d) {
    throw new Error(`No path data found for ${icon.slug}`);
  }
  return { ...icon, d };
}

const icons = await Promise.all(ICONS.map(fetchIcon));

const styles = icons
  .map(({ slug, color }) => {
    const fill = LIGHT_COLORS[slug] ?? color;
    return `    .icon-${slug} { fill: ${fill}; }`;
  })
  .join("\n");

const darkStyles = icons
  .filter(({ slug }) => DARK_COLORS[slug])
  .map(({ slug }) => `      .icon-${slug} { fill: ${DARK_COLORS[slug]}; }`)
  .join("\n");

const cells = [];
for (let row = 0; row < ROWS; row++) {
  const rowIcons = icons.slice(row * COLUMNS, (row + 1) * COLUMNS);
  const rowWidth = rowIcons.length * ICON_SIZE + (rowIcons.length - 1) * GAP;
  const startX = PADDING + (GRID_WIDTH - rowWidth) / 2;
  const y = PADDING + row * (ICON_SIZE + GAP);

  rowIcons.forEach((icon, column) => {
    const x = startX + column * (ICON_SIZE + GAP);
    const index = row * COLUMNS + column;
    cells.push(
      `  <g transform="translate(${x} ${y})">\n` +
        `    <g class="enter icon-${icon.slug}" style="animation-delay:${index * 55}ms">\n` +
        `      <g transform="scale(${ICON_SIZE / 24})">\n` +
        `        <title>${icon.title}</title>\n` +
        `        <path d="${icon.d}"/>\n` +
        `      </g>\n` +
        `    </g>\n` +
        `  </g>`,
    );
  });
}

const description = icons.map((icon) => icon.title).join(", ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="tech-stack-title tech-stack-desc">
  <title id="tech-stack-title">Tech stack</title>
  <desc id="tech-stack-desc">${description}</desc>
  <style>
${styles}
    .enter {
      animation: icon-in 650ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
      transform-box: fill-box;
      transform-origin: center;
    }
    @keyframes icon-in {
      from { opacity: 0; transform: translateY(12px) scale(0.82); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .enter { animation: none; }
    }
    @media (prefers-color-scheme: dark) {
${darkStyles}
    }
  </style>
${cells.join("\n")}
</svg>
`;

await writeFile(new URL("../tech-stack.svg", import.meta.url), svg);
console.log(`Wrote tech-stack.svg (${WIDTH}x${HEIGHT}, ${icons.length} icons)`);
