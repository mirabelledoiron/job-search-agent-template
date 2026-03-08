import { Client } from "@notionhq/client";
import type { RunSummary, ScoredJob } from "../types.js";

export const notion = new Client({ auth: process.env.NOTION_TOKEN });

export const IDS = {
  dailySummaries: process.env.NOTION_DAILY_SUMMARIES_PAGE_ID ?? "",
  jobTracker: process.env.NOTION_JOB_TRACKER_DB_ID ?? "",
};

export async function writeDailySummary(summary: RunSummary): Promise<void> {
  if (!IDS.dailySummaries) throw new Error("NOTION_DAILY_SUMMARIES_PAGE_ID is not set.");
  if (!IDS.jobTracker) throw new Error("NOTION_JOB_TRACKER_DB_ID is not set.");

  const date = new Date(summary.runAt).toISOString().split("T")[0];
  const top = summary.topMatches.slice(0, 25);

  const appliedUrls = await getAppliedUrls();
  const newJobs = top.filter((j) => !appliedUrls.has(j.url));
  const alreadyApplied = top.filter((j) => appliedUrls.has(j.url));

  await notion.pages.create({
    parent: { page_id: IDS.dailySummaries },
    properties: {
      title: {
        title: [{ type: "text", text: { content: `${date} — ${summary.topMatches.length} matches` } }],
      },
    },
    children: [
      heading("Run Summary"),
      bullet(`Date: ${summary.runAt}`),
      bullet(`Sources: ${summary.sourcesSearched.join(", ")}`),
      bullet(`Total jobs found: ${summary.totalFound}`),
      bullet(`Jobs scored: ${summary.totalScored}`),
      bullet(`Top matches (score >= 60): ${summary.topMatches.length}`),
      bullet(`Duration: ${(summary.durationMs / 1000).toFixed(1)}s`),
      divider(),
      heading("Top Matches"),
      ...(newJobs.length > 0 ? [jobTable(newJobs)] : [bullet("No new matches today.")]),
      divider(),
      heading("Why These Made It"),
      ...newJobs.map((job) => reasoningBlock(job)),
      ...(alreadyApplied.length > 0
        ? [
            divider(),
            heading("Already Applied"),
            ...alreadyApplied.map((job) =>
              bullet(`${job.title} at ${job.company} — score ${job.score}/100`)
            ),
          ]
        : []),
      ...(summary.errors.length > 0
        ? [divider(), heading("Errors"), ...summary.errors.map((e) => bullet(`${e.source}: ${e.error}`))]
        : []),
    ],
  });

  await writeToJobTracker(newJobs, date, appliedUrls);
}

async function getAppliedUrls(): Promise<Set<string>> {
  const result = await notion.databases.query({
    database_id: IDS.jobTracker,
    filter: { property: "Applied", checkbox: { equals: true } },
  });
  return new Set(
    result.results.map((p) => {
      const props = (p as { properties: Record<string, { url?: string }> }).properties;
      return props["Link"]?.url ?? "";
    })
  );
}

async function writeToJobTracker(jobs: ScoredJob[], date: string, appliedUrls: Set<string>): Promise<void> {
  const existing = await notion.databases.query({
    database_id: IDS.jobTracker,
    filter: {
      property: "Date Found",
      date: { on_or_after: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
    },
  });

  const existingUrls = new Set(
    existing.results.map((p) => {
      const props = (p as { properties: Record<string, { url?: string }> }).properties;
      return props["Link"]?.url ?? "";
    })
  );

  await Promise.allSettled(
    jobs
      .filter((job) => !existingUrls.has(job.url) && !appliedUrls.has(job.url))
      .map((job) =>
        notion.pages.create({
          parent: { database_id: IDS.jobTracker },
          properties: {
            "Job Title": { title: [{ type: "text", text: { content: job.title } }] },
            "Company": { rich_text: [{ type: "text", text: { content: job.company } }] },
            "Score": { number: job.score },
            "Salary": { rich_text: [{ type: "text", text: { content: formatSalary(job) } }] },
            "Salary Fit": { select: { name: job.salaryFit } },
            "Source": { select: { name: job.source } },
            "Link": { url: job.url },
            "Applied": { checkbox: false },
            "Date Found": { date: { start: date } },
          },
        })
      )
  );
}

// --- Block helpers ---

function heading(text: string) {
  return {
    object: "block" as const,
    type: "heading_2" as const,
    heading_2: { rich_text: [{ type: "text" as const, text: { content: text } }] },
  };
}

function bullet(text: string) {
  return {
    object: "block" as const,
    type: "bulleted_list_item" as const,
    bulleted_list_item: { rich_text: [{ type: "text" as const, text: { content: text } }] },
  };
}

function divider() {
  return { object: "block" as const, type: "divider" as const, divider: {} };
}

function jobTable(jobs: ScoredJob[]) {
  const headers = ["Title", "Company", "Score", "Salary", "Salary Fit", "Date Posted", "Source", "Link"];
  return {
    object: "block" as const,
    type: "table" as const,
    table: {
      table_width: headers.length,
      has_column_header: true,
      has_row_header: false,
      children: [plainRow(headers), ...jobs.map((job) => jobRow(job))],
    },
  };
}

function plainRow(cells: string[]) {
  return {
    object: "block" as const,
    type: "table_row" as const,
    table_row: {
      cells: cells.map((cell) => [{ type: "text" as const, text: { content: cell } }]),
    },
  };
}

function jobRow(job: ScoredJob) {
  return {
    object: "block" as const,
    type: "table_row" as const,
    table_row: {
      cells: [
        [{ type: "text" as const, text: { content: job.title, link: { url: job.url } } }],
        [{ type: "text" as const, text: { content: job.company } }],
        [{ type: "text" as const, text: { content: `${job.score}/100` } }],
        [{ type: "text" as const, text: { content: formatSalary(job) } }],
        [{ type: "text" as const, text: { content: job.salaryFit } }],
        [{ type: "text" as const, text: { content: formatDate(job.postedAt) } }],
        [{ type: "text" as const, text: { content: job.source } }],
        [{ type: "text" as const, text: { content: "→ Apply", link: { url: job.url } } }],
      ],
    },
  };
}

function reasoningBlock(job: ScoredJob) {
  return {
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [
        { type: "text" as const, text: { content: `${job.title} at ${job.company} — ` }, annotations: { bold: true } },
        { type: "text" as const, text: { content: job.reasoning } },
      ],
    },
  };
}

export function formatSalary(job: ScoredJob): string {
  if (!job.salary?.min) return "—";
  const min = job.salary.min.toLocaleString();
  const max = job.salary.max?.toLocaleString() ?? min;
  return `$${min}–$${max}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().split("T")[0];
}
