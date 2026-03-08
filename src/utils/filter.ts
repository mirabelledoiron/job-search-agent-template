import type { Job } from "../types.js";
import { config } from "../config/requirements.js";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const DATE_FILTERED_SOURCES = new Set([
  "Remotive",
  "RemoteOK",
  "Dice",
  "We Work Remotely",
  "Adzuna",
  "LinkedIn",
]);

const TRUSTED_SOURCE_KEYWORDS = [
  ["frontend", "engineer"],
  ["front-end", "engineer"],
  ["design", "engineer"],
];

export function filterByRequirements(jobs: Job[]): Job[] {
  const now = Date.now();
  const titleKeywords = config.titleKeywords.map((k) => k.toLowerCase());
  const excludeTitles = config.excludeTitles.map((t) => t.toLowerCase());

  return jobs.filter((job) => {
    const titleLower = job.title.toLowerCase();

    if (DATE_FILTERED_SOURCES.has(job.source) && job.postedAt) {
      const posted = new Date(job.postedAt).getTime();
      if (!isNaN(posted) && now - posted > FOURTEEN_DAYS_MS) return false;
    }

    const titleMatch =
      config.titles.some((t) => titleLower.includes(t.toLowerCase())) ||
      titleKeywords.some((k) => titleLower.includes(k));

    const trustedMatch =
      (job.source === "Greenhouse" || job.source === "Ashby") &&
      TRUSTED_SOURCE_KEYWORDS.some(([a, b]) => titleLower.includes(a) && titleLower.includes(b));

    const excluded = excludeTitles.some((k) => titleLower === k);

    const locationLower = (job.location ?? "").toLowerCase();
    const locationMatch =
      job.remote ||
      config.locations.some((l) => locationLower.includes(l.toLowerCase()));

    return (titleMatch || trustedMatch) && !excluded && locationMatch;
  });
}
