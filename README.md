# Job Search Agent

An automated daily job search agent that finds roles matching your criteria, scores each one 0–100 using Claude, and delivers the top matches to a Notion page every morning.

Runs on GitHub Actions — no server required. Free to run (within GitHub's free tier and Claude's API costs).

## How it works

1. Pulls jobs from 11 sources: Remotive, RemoteOK, We Work Remotely, Greenhouse, Ashby, Adzuna, Dice, Built In, YC Work at a Startup, Talent.com, Dribbble
2. Deduplicates across all sources
3. Filters by your job titles, keywords, and location preferences
4. Scores each match 0–100 using Claude against your specific criteria
5. Writes a daily summary page to Notion with top matches, scores, salary fit, and reasoning
6. Tracks applications in a Job Tracker database
7. Jobs you mark as Applied are flagged in future runs — never shown as new again

## Quick start

### 1. Use this template

Click **Use this template** on GitHub to create your own copy of this repo.

### 2. Install dependencies

```bash
npm install
```

### 3. Run the setup wizard

```bash
npm run setup
```

The wizard will:
- Ask for your job titles, salary, skills, and industries
- Ask for your API keys (Anthropic, Notion, optionally Adzuna)
- Automatically create your Notion workspace (Daily Summaries page + Job Tracker database)
- Write `config.json` and `.env` for you

### 4. Test locally

```bash
npm run dev
```

### 5. Deploy to GitHub Actions

1. Push to GitHub
2. Go to **Settings → Secrets and variables → Actions**
3. Add the secrets printed at the end of `npm run setup`
4. The agent runs automatically every day at 6AM ET

You can also trigger it manually from the **Actions** tab at any time.

## Stack

- **TypeScript / Node.js** (ESM modules, tsx for local dev)
- **Claude API** (`claude-sonnet-4-6`) — job scoring and reasoning via structured JSON output
- **Notion API** (`@notionhq/client`) — daily summary pages + Job Tracker database
- **GitHub Actions** — scheduled cron, no server needed
- **Adzuna API** — optional free job data API (register at developer.adzuna.com)
- **Greenhouse / Ashby public ATS APIs** — no auth required
- **cheerio** — HTML scraping for sources without APIs
- **fast-xml-parser** — RSS feed parsing
- **inquirer** — interactive CLI setup wizard

## Configuration

All your preferences live in `config.json` (created by `npm run setup`, gitignored).

You can edit it directly at any time:

```json
{
  "titles": ["UX Engineer", "Design Engineer"],
  "titleKeywords": ["design system", "ui engineer"],
  "excludeTitles": ["Designer", "Software Engineer"],
  "salary": { "floor": 100000, "targetMin": 130000, "targetMax": 170000, "stretch": 190000 },
  "seniority": "Senior IC",
  "skills": ["React", "TypeScript", "Figma"],
  "industries": { "target": ["SaaS", "AI"], "avoid": ["backend infrastructure"] },
  "minScore": 60,
  "greenhouse": { "Figma": "figma", "Vercel": "vercel" },
  "ashby": { "Linear": "linear", "Raycast": "raycast" }
}
```

See `config.example.json` for the full structure with all options.

## Project structure

```
src/
├── config/requirements.ts   # loads config.json at runtime
├── setup/index.ts           # interactive setup wizard (npm run setup)
├── sources/                 # one file per job board
├── matching/scorer.ts       # Claude scoring logic
├── notion/writer.ts         # writes results to Notion
├── utils/                   # deduplication and filtering
└── index.ts                 # main runner
```

## Applied job tracking

Jobs marked as **Applied** in the Job Tracker are handled automatically on every run:

1. Before writing anything, the agent queries the Job Tracker for all jobs where `Applied = true`
2. Top matches are split — applied jobs go to a separate "Already Applied" bucket
3. The daily summary shows new jobs in the main table; applied jobs appear in an "Already Applied" section at the bottom
4. Applied jobs are never re-added to the Job Tracker

## Weekly unemployment report

If you're tracking applications for unemployment insurance or similar:

```bash
npm run weekly
```

Generates a formatted weekly report page in Notion with a table of all applied jobs.

## Adding a new source

1. Create `src/sources/mysource.ts` and export `fetchMySource(): Promise<Job[]>`
2. Import and add it to the `SOURCES` array in `src/index.ts`

Each source is isolated — if one fails, the rest continue.

## Sources that require a browser (not supported)

LinkedIn, Indeed, and Welcome to the Jungle block automated requests from cloud servers (GitHub Actions runs on Azure IPs). They cannot be added without a paid proxy service.

Manual search links:
- [LinkedIn — UX Engineer](https://www.linkedin.com/jobs/search/?keywords=ux%20engineer&f_WT=2&sortBy=DD)
- [LinkedIn — Design Engineer](https://www.linkedin.com/jobs/search/?keywords=design%20engineer&f_WT=2&sortBy=DD)
- [Indeed — UX Engineer remote](https://www.indeed.com/jobs?q=ux+engineer&l=remote&sort=date)
- [Indeed — Design Engineer remote](https://www.indeed.com/jobs?q=design+engineer&l=remote&sort=date)
- [Welcome to the Jungle — UX Engineer](https://www.welcometothejungle.com/en/jobs?query=ux+engineer&remoteOnly=true)
