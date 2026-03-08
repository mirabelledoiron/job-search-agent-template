import "dotenv/config";
import { fetchRemotive } from "./sources/remotive.js";
import { fetchRemoteOK } from "./sources/remoteok.js";
import { fetchWeWorkRemotely } from "./sources/weworkremotely.js";
import { fetchGreenhouse } from "./sources/greenhouse.js";
import { fetchAshby } from "./sources/ashby.js";
import { fetchAdzuna } from "./sources/adzuna.js";
import { fetchBuiltIn } from "./sources/builtin.js";
import { fetchDice } from "./sources/dice.js";
import { fetchWorkAtAStartup } from "./sources/workatastartup.js";
import { fetchTalent } from "./sources/talent.js";
import { fetchDribbble } from "./sources/dribbble.js";
import { scoreJobs } from "./matching/scorer.js";
import { writeDailySummary } from "./notion/writer.js";
import { deduplicateJobs } from "./utils/deduplicate.js";
import { filterByRequirements } from "./utils/filter.js";
import type { Job, RunSummary } from "./types.js";
import { config } from "./config/requirements.js";

const SOURCES = [
  { name: "Remotive", fetch: fetchRemotive },
  { name: "RemoteOK", fetch: fetchRemoteOK },
  { name: "We Work Remotely", fetch: fetchWeWorkRemotely },
  { name: "Greenhouse", fetch: fetchGreenhouse },
  { name: "Ashby", fetch: fetchAshby },
  { name: "Adzuna", fetch: fetchAdzuna },
  { name: "Built In", fetch: fetchBuiltIn },
  { name: "Dice", fetch: fetchDice },
  { name: "YC Work at a Startup", fetch: fetchWorkAtAStartup },
  { name: "Talent.com", fetch: fetchTalent },
  { name: "Dribbble", fetch: fetchDribbble },
];

async function run(): Promise<void> {
  const startedAt = Date.now();
  const runAt = new Date().toISOString();
  const errors: RunSummary["errors"] = [];
  const allJobs: Job[] = [];

  console.log(`[${runAt}] Starting job search run`);

  const settled = await Promise.allSettled(SOURCES.map((s) => s.fetch()));

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const source = SOURCES[i];
    if (result.status === "fulfilled") {
      console.log(`  ${source.name}: ${result.value.length} jobs`);
      allJobs.push(...result.value);
    } else {
      const message =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.warn(`  ${source.name}: failed — ${message}`);
      errors.push({ source: source.name, error: message });
    }
  }

  const unique = deduplicateJobs(allJobs);
  const relevant = filterByRequirements(unique);
  console.log(
    `\nTotal: ${allJobs.length} found → ${unique.length} unique → ${relevant.length} relevant`
  );

  console.log(`Scoring ${relevant.length} jobs with Claude...`);
  const scored = await scoreJobs(relevant);
  const topMatches = scored.filter((j) => j.score >= config.minScore);
  console.log(`${topMatches.length} matches at score >= ${config.minScore}`);

  const summary: RunSummary = {
    runAt,
    sourcesSearched: SOURCES.map((s) => s.name),
    totalFound: allJobs.length,
    totalScored: scored.length,
    topMatches,
    errors,
    durationMs: Date.now() - startedAt,
  };

  console.log(`Writing to Notion...`);
  await writeDailySummary(summary);

  console.log(`Done in ${(summary.durationMs / 1000).toFixed(1)}s`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
