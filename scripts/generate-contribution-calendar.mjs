#!/usr/bin/env node
// Generates a GitHub-style contribution calendar as an SVG with a custom
// yellow palette. Data comes from the public profile contributions endpoint,
// so no token or API scope is required.
import { writeFile } from "node:fs/promises";
import { extraContributions } from "./extra-contributions.mjs";

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

/** @type {{ date: string, weekday: number, week: number }[]} */
const days = [];

for (const match of html.matchAll(/<td\b[^>]*>/g)) {
  const tag = match[0];
  const date = tag.match(/data-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
  if (!date) continue;

  const id = tag.match(/id="contribution-day-component-(\d+)-(\d+)"/);
  if (!id) continue;

  days.push({
    date,
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

// Extra counts are static data kept in this repository, so the calendar has no
// runtime dependency on another repository.
for (const [date, count] of Object.entries(extraContributions)) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isInteger(count) ||
    count < 0
  ) {
    throw new Error(`Invalid extra contribution entry: ${date}=${count}`);
  }
}

const calendarDates = new Set(days.map((day) => day.date));
for (const date of Object.keys(extraContributions)) {
  if (!calendarDates.has(date)) {
    console.warn(`Extra contribution date outside the calendar window: ${date}`);
  }
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

function contributionLevel(count) {
  if (count <= 0) return 0;
  if (count <= 4) return 1;
  if (count <= 8) return 2;
  if (count <= 12) return 3;
  return 4;
}

function render(palette) {
  const svg = [];
  svg.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Contribution calendar for ${username}">`,
  );
  svg.push(
    `<style>text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:9px;fill:${palette.text}}.day{transition:transform .12s ease;transform-box:fill-box;transform-origin:center;animation:day-in .55s cubic-bezier(.22,1,.36,1) backwards}.day:hover{transform:scale(1.35)}.lit{animation:day-in .55s cubic-bezier(.22,1,.36,1) backwards,shimmer 7s ease-in-out infinite}.label,.legend{animation:label-in .5s ease-out backwards}@keyframes day-in{from{opacity:0;scale:.3}to{opacity:1;scale:1}}@keyframes label-in{from{opacity:0}to{opacity:1}}@keyframes shimmer{0%,86%,100%{filter:none}89%{filter:brightness(1.35) saturate(1.25)}92%{filter:none}}@media (prefers-reduced-motion:reduce){.day,.lit,.label,.legend{animation:none}.day{transition:none}}</style>`,
  );

  // Month labels sit above the week containing the 1st of each month.
  for (let week = 0; week < weeks.length; week++) {
    const firstOfMonth = (weeks[week] ?? []).find(
      (day) => day && day.date.endsWith("-01"),
    );
    if (!firstOfMonth) continue;

    const month = new Date(`${firstOfMonth.date}T00:00:00Z`).getUTCMonth();
    const x = LEFT + week * STEP;
    svg.push(`<text class="label" x="${x}" y="10">${MONTHS[month]}</text>`);
  }

  // Weekday labels.
  for (const [weekday, label] of WEEKDAY_LABELS) {
    const y = TOP + weekday * STEP + 8;
    svg.push(
      `<text class="label" x="${LEFT - 6}" y="${y}" text-anchor="end">${label}</text>`,
    );
  }

  // Day squares.
  for (let week = 0; week < weeks.length; week++) {
    for (let weekday = 0; weekday < 7; weekday++) {
      const day = weeks[week]?.[weekday];
      if (!day) continue;

      const x = LEFT + week * STEP;
      const y = TOP + weekday * STEP;
      const githubCount =
        counts.get(`contribution-day-component-${weekday}-${week}`) ?? 0;
      const count = githubCount + (extraContributions[day.date] ?? 0);
      const level = contributionLevel(count);
      const title =
        count === 0
          ? `No contributions on ${formatDate(day.date)}`
          : `${count} contribution${count === 1 ? "" : "s"} on ${formatDate(day.date)}`;

      const lit = level > 0;
      // Entry runs as a diagonal sweep from the oldest week to the newest.
      // Lit squares keep their shimmer as a second animation with a negative
      // delay so the existing wave starts immediately instead of after a cycle.
      const enterDelay = week * 12 + weekday * 8;
      const delays = lit
        ? `${enterDelay}ms, ${week * 35 - 6230}ms`
        : `${enterDelay}ms`;

      svg.push(
        `<rect class="day${lit ? " lit" : ""}" style="animation-delay:${delays}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${palette.levels[level] ?? palette.levels[0]}"><title>${title}</title></rect>`,
      );
    }
  }

  // Legend.
  const legendY = TOP + 7 * STEP + 6;
  const squareStep = CELL + 3;
  const squaresWidth = 5 * CELL + 4 * 3;
  const squaresX = WIDTH - 4 - 26 - 4 - squaresWidth;
  const legendDelay = weeks.length * 12 + 80;

  svg.push(
    `<text class="label" x="${squaresX - 6}" y="${legendY + 8}" text-anchor="end" style="animation-delay:${legendDelay}ms">Less</text>`,
  );

  for (let level = 0; level < 5; level++) {
    svg.push(
      `<rect class="legend" x="${squaresX + level * squareStep}" y="${legendY}" width="${CELL}" height="${CELL}" rx="2" fill="${palette.levels[level]}" style="animation-delay:${legendDelay + level * 40}ms"/>`,
    );
  }

  svg.push(
    `<text class="label" x="${WIDTH - 4}" y="${legendY + 8}" text-anchor="end" style="animation-delay:${legendDelay + 200}ms">More</text>`,
  );
  svg.push("</svg>");

  return svg.join("\n") + "\n";
}

await writeFile("contrib-calendar.svg", render(palettes.light));
await writeFile("contrib-calendar-dark.svg", render(palettes.dark));

const extraTotal = Object.values(extraContributions).reduce(
  (sum, count) => sum + count,
  0,
);

console.log(
  `Wrote contribution calendars for ${username}: ${days.length} days, ${weeks.length} weeks, ${extraTotal} extra contributions`,
);
