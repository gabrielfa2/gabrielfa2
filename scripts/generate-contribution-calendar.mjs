#!/usr/bin/env node
// Generates a GitHub-style contribution calendar as an SVG with a custom
// yellow palette. Data comes from the public profile contributions endpoint,
// so no token or API scope is required.
import { writeFile } from "node:fs/promises";

const username = process.env.GITHUB_REPOSITORY_OWNER || "gabrielfa2";
const endpoint = `https://github.com/users/${encodeURIComponent(username)}/contributions`;

const response = await fetch(endpoint, {
  headers: {
    "User-Agent": `${username}-profile-readme`,
    Accept: "text/html",
  },
});

if (!response.ok) {
  throw new Error(
    `Failed to fetch contributions for ${username}: ${response.status} ${response.statusText}`,
  );
}

const html = await response.text();

/** @type {{ date: string, level: number, weekday: number, week: number }[]} */
const days = [];

for (const match of html.matchAll(/<td\b[^>]*>/g)) {
  const tag = match[0];
  const date = tag.match(/data-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
  if (!date) continue;

  const level = Number(tag.match(/data-level="(\d+)"/)?.[1] ?? 0);
  const id = tag.match(/id="contribution-day-component-(\d+)-(\d+)"/);
  if (!id) continue;

  days.push({
    date,
    level,
    weekday: Number(id[1]),
    week: Number(id[2]),
  });
}

if (days.length === 0) {
  throw new Error("No contribution days found in the GitHub response");
}

// Map each day cell to its contribution count from the matching tooltip.
const counts = new Map();
for (const match of html.matchAll(
  /<tool-tip\b[^>]*for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)<\/tool-tip>/g,
)) {
  const text = match[2].trim();
  const count = text.startsWith("No contributions")
    ? 0
    : Number(text.match(/^(\d+)/)?.[1] ?? 0);
  counts.set(match[1], count);
}

const weeks = [];
for (const day of days) {
  (weeks[day.week] ??= [])[day.weekday] = day;
}

const CELL = 10;
const GAP = 2;
const STEP = CELL + GAP;
const LEFT = 30;
const TOP = 20;
const WIDTH = LEFT + weeks.length * STEP - GAP + 4;
const HEIGHT = TOP + 7 * STEP - GAP + 26;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAY_LABELS = new Map([
  [1, "Mon"],
  [3, "Wed"],
  [5, "Fri"],
]);

const palettes = {
  light: {
    text: "#57606a",
    levels: ["#ebedf0", "#fff3b0", "#ffe066", "#ffc300", "#e09f00"],
  },
  dark: {
    text: "#8b949e",
    levels: ["#21262d", "#4d3800", "#806000", "#c79400", "#ffd33d"],
  },
};

function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function render(palette) {
  const svg = [];
  svg.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Contribution calendar for ${username}">`,
  );
  svg.push(
    `<style>text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:9px;fill:${palette.text}}.day{transition:transform .12s ease;transform-box:fill-box;transform-origin:center}.day:hover{transform:scale(1.35)}.lit{animation:shimmer 7s ease-in-out infinite}@keyframes shimmer{0%,86%,100%{filter:none}89%{filter:brightness(1.35) saturate(1.25)}92%{filter:none}}@media (prefers-reduced-motion:reduce){.lit{animation:none}.day{transition:none}}</style>`,
  );

  // Month labels sit above the week containing the 1st of each month.
  for (let week = 0; week < weeks.length; week++) {
    const firstOfMonth = (weeks[week] ?? []).find(
      (day) => day && day.date.endsWith("-01"),
    );
    if (!firstOfMonth) continue;

    const month = new Date(`${firstOfMonth.date}T00:00:00Z`).getUTCMonth();
    const x = LEFT + week * STEP;
    svg.push(`<text x="${x}" y="10">${MONTHS[month]}</text>`);
  }

  // Weekday labels.
  for (const [weekday, label] of WEEKDAY_LABELS) {
    const y = TOP + weekday * STEP + 8;
    svg.push(
      `<text x="${LEFT - 6}" y="${y}" text-anchor="end">${label}</text>`,
    );
  }

  // Day squares.
  for (let week = 0; week < weeks.length; week++) {
    for (let weekday = 0; weekday < 7; weekday++) {
      const day = weeks[week]?.[weekday];
      if (!day) continue;

      const x = LEFT + week * STEP;
      const y = TOP + weekday * STEP;
      const count =
        counts.get(`contribution-day-component-${weekday}-${week}`) ?? 0;
      const title =
        count === 0
          ? `No contributions on ${formatDate(day.date)}`
          : `${count} contribution${count === 1 ? "" : "s"} on ${formatDate(day.date)}`;

      const lit = day.level > 0;
      const style = lit ? ` style="animation-delay:${week * 35}ms"` : "";

      svg.push(
        `<rect class="day${lit ? " lit" : ""}"${style} x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${palette.levels[day.level] ?? palette.levels[0]}"><title>${title}</title></rect>`,
      );
    }
  }

  // Legend.
  const legendY = TOP + 7 * STEP + 6;
  const squareStep = CELL + 3;
  const squaresWidth = 5 * CELL + 4 * 3;
  const squaresX = WIDTH - 4 - 26 - 4 - squaresWidth;

  svg.push(
    `<text x="${squaresX - 6}" y="${legendY + 8}" text-anchor="end">Less</text>`,
  );

  for (let level = 0; level < 5; level++) {
    svg.push(
      `<rect x="${squaresX + level * squareStep}" y="${legendY}" width="${CELL}" height="${CELL}" rx="2" fill="${palette.levels[level]}"/>`,
    );
  }

  svg.push(
    `<text x="${WIDTH - 4}" y="${legendY + 8}" text-anchor="end">More</text>`,
  );
  svg.push("</svg>");

  return svg.join("\n") + "\n";
}

await writeFile("contrib-calendar.svg", render(palettes.light));
await writeFile("contrib-calendar-dark.svg", render(palettes.dark));

console.log(
  `Wrote contribution calendars for ${username}: ${days.length} days, ${weeks.length} weeks`,
);
