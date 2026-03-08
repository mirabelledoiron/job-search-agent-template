import Anthropic from "@anthropic-ai/sdk";
import type { Job, ScoredJob } from "../types.js";
import { config } from "../config/requirements.js";

const client = new Anthropic();

const REQUIREMENTS_SUMMARY = `
Target titles: ${config.titles.join(", ")}
Core skills: ${config.skills.join(", ")}
Seniority: ${config.seniority}
Salary floor: $${config.salary.floor.toLocaleString()}
Target salary: $${config.salary.targetMin.toLocaleString()}–$${config.salary.targetMax.toLocaleString()}
Work type: ${config.remote ? "Full remote" : "On-site or hybrid"}
Industries (prefer): ${config.industries.target.join(", ")}
Industries (avoid): ${config.industries.avoid.join(", ")}
`.trim();

export async function scoreJob(job: Job): Promise<ScoredJob> {
  const salaryLine = job.salary?.min
    ? `Salary: $${job.salary.min.toLocaleString()}–$${(job.salary.max ?? job.salary.min).toLocaleString()}`
    : "Salary: not listed";

  const prompt = `${REQUIREMENTS_SUMMARY}

Job posting:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
${salaryLine}
Description:
${job.description.slice(0, 2000)}

Score this job 0–100 for the candidate above. Return ONLY valid JSON, no other text:
{"score":<integer>,"reasoning":"<one sentence>","salaryFit":"<below_floor|at_floor|target|stretch|unknown>"}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 150,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "{}";

  let parsed: { score: number; reasoning: string; salaryFit: ScoredJob["salaryFit"] };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { score: 0, reasoning: "Failed to parse scorer response.", salaryFit: "unknown" };
  }

  return { ...job, ...parsed };
}

export async function scoreJobs(jobs: Job[]): Promise<ScoredJob[]> {
  const BATCH = 5;
  const scored: ScoredJob[] = [];

  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH);
    const settled = await Promise.allSettled(batch.map(scoreJob));
    for (const result of settled) {
      if (result.status === "fulfilled") scored.push(result.value);
    }
  }

  return scored.sort((a, b) => b.score - a.score);
}
