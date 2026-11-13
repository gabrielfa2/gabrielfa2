// Shared fetching/parsing of the public GitHub contributions calendar, used by
// the contribution-based SVG generators. Data comes from the public profile
// contributions endpoint, so no token or API scope is required.
import { extraContributions } from "./extra-contributions.mjs";

export { extraContributions };

const username = process.env.GITHUB_REPOSITORY_OWNER || "gabrielfa2";

export async function fetchContributions() {
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

  return { username, days, counts };
}
