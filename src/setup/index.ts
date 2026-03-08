#!/usr/bin/env node
// Interactive setup wizard.
// Run with: npm run setup
// Creates config.json and .env from user input, then auto-creates your Notion workspace.
import "dotenv/config";
import { writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import inquirer from "inquirer";
import { Client } from "@notionhq/client";

const CONFIG_PATH = resolve(process.cwd(), "config.json");
const ENV_PATH = resolve(process.cwd(), ".env");

async function main() {
  console.log("\nJob Search Agent — Setup\n");
  console.log("This wizard creates your config.json and .env, then builds your Notion workspace.\n");

  if (existsSync(CONFIG_PATH)) {
    const { overwrite } = await inquirer.prompt([{
      type: "confirm",
      name: "overwrite",
      message: "config.json already exists. Overwrite it?",
      default: false,
    }]);
    if (!overwrite) {
      console.log("Setup cancelled.");
      process.exit(0);
    }
  }

  // --- API Keys ---
  console.log("\nStep 1 of 4 — API Keys\n");
  const keys = await inquirer.prompt([
    {
      type: "password",
      name: "anthropicKey",
      message: "Anthropic API key (console.anthropic.com):",
      validate: (v) => v.trim().length > 0 || "Required",
    },
    {
      type: "password",
      name: "notionToken",
      message: "Notion integration token (notion.so/my-integrations):",
      validate: (v) => v.trim().length > 0 || "Required",
    },
    {
      type: "password",
      name: "adzunaId",
      message: "Adzuna App ID (optional — press Enter to skip):",
    },
    {
      type: "password",
      name: "adzunaKey",
      message: "Adzuna App Key (optional — press Enter to skip):",
    },
  ]);

  // --- Job Criteria ---
  console.log("\nStep 2 of 4 — Job Criteria\n");
  const criteria = await inquirer.prompt([
    {
      type: "input",
      name: "titles",
      message: "Job titles to search for (comma-separated):",
      default: "UX Engineer, Design Engineer, Design Systems Engineer, Design Technologist",
      filter: (v: string) => v.split(",").map((t) => t.trim()).filter(Boolean),
    },
    {
      type: "input",
      name: "keywords",
      message: "Additional title keywords (comma-separated, for broader matching):",
      default: "design system, ux engineer, ui engineer, design engineer, design technologist",
      filter: (v: string) => v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
    },
    {
      type: "input",
      name: "excludeTitles",
      message: "Exact titles to exclude (comma-separated):",
      default: "Designer, Software Engineer",
      filter: (v: string) => v.split(",").map((t) => t.trim()).filter(Boolean),
    },
    {
      type: "input",
      name: "skills",
      message: "Your core skills (comma-separated, used in Claude scoring):",
      default: "React, TypeScript, Figma, CSS, design systems, accessibility",
      filter: (v: string) => v.split(",").map((t) => t.trim()).filter(Boolean),
    },
    {
      type: "input",
      name: "seniority",
      message: "Seniority level:",
      default: "Senior IC",
    },
  ]);

  // --- Salary ---
  console.log("\nStep 3 of 4 — Salary\n");
  const salary = await inquirer.prompt([
    {
      type: "number",
      name: "floor",
      message: "Minimum acceptable salary (floor):",
      default: 100000,
    },
    {
      type: "number",
      name: "targetMin",
      message: "Target salary — minimum:",
      default: 130000,
    },
    {
      type: "number",
      name: "targetMax",
      message: "Target salary — maximum:",
      default: 170000,
    },
    {
      type: "number",
      name: "stretch",
      message: "Stretch / dream salary:",
      default: 190000,
    },
  ]);

  // --- Industries & Companies ---
  console.log("\nStep 4 of 4 — Industries & Target Companies\n");
  const industries = await inquirer.prompt([
    {
      type: "input",
      name: "target",
      message: "Industries to target (comma-separated):",
      default: "SaaS, AI, developer tools, design tooling",
      filter: (v: string) => v.split(",").map((t) => t.trim()).filter(Boolean),
    },
    {
      type: "input",
      name: "avoid",
      message: "Industries to avoid (comma-separated):",
      default: "backend infrastructure, data pipelines, distributed systems",
      filter: (v: string) => v.split(",").map((t) => t.trim()).filter(Boolean),
    },
    {
      type: "number",
      name: "minScore",
      message: "Minimum Claude score to surface a job (0–100, recommended: 60):",
      default: 60,
    },
  ]);

  const { addCompanies } = await inquirer.prompt([{
    type: "confirm",
    name: "addCompanies",
    message: "Add target companies for Greenhouse/Ashby direct search? (You can also edit config.json later)",
    default: false,
  }]);

  let greenhouse: Record<string, string> = {
    Figma: "figma",
    Vercel: "vercel",
    Stripe: "stripe",
    Webflow: "webflow",
    Discord: "discord",
  };
  let ashby: Record<string, string> = {
    Linear: "linear",
    Retool: "retool",
    Raycast: "raycast",
  };

  if (addCompanies) {
    console.log("\nFor Greenhouse slugs, find them at: boards.greenhouse.io/{slug}");
    console.log("For Ashby slugs: jobs.ashbyhq.com/{slug}\n");

    const { ghInput } = await inquirer.prompt([{
      type: "input",
      name: "ghInput",
      message: 'Greenhouse companies — format: "Company:slug, Company:slug" (Enter to use defaults):',
    }]);

    if (ghInput.trim()) {
      greenhouse = {};
      for (const pair of ghInput.split(",")) {
        const [name, slug] = pair.split(":").map((s) => s.trim());
        if (name && slug) greenhouse[name] = slug;
      }
    }

    const { ashbyInput } = await inquirer.prompt([{
      type: "input",
      name: "ashbyInput",
      message: 'Ashby companies — format: "Company:slug, Company:slug" (Enter to use defaults):',
    }]);

    if (ashbyInput.trim()) {
      ashby = {};
      for (const pair of ashbyInput.split(",")) {
        const [name, slug] = pair.split(":").map((s) => s.trim());
        if (name && slug) ashby[name] = slug;
      }
    }
  }

  // --- Write config.json ---
  const config = {
    titles: criteria.titles,
    titleKeywords: criteria.keywords,
    excludeTitles: criteria.excludeTitles,
    salary: {
      floor: salary.floor,
      targetMin: salary.targetMin,
      targetMax: salary.targetMax,
      stretch: salary.stretch,
    },
    seniority: criteria.seniority,
    remote: true,
    locations: ["remote", "us", "usa", "united states", "anywhere", "worldwide"],
    skills: criteria.skills,
    industries: {
      target: industries.target,
      avoid: industries.avoid,
    },
    minScore: industries.minScore,
    greenhouse,
    ashby,
  };

  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log("\nconfig.json created.");

  // --- Set up Notion workspace ---
  console.log("\nSetting up Notion workspace...");
  const notion = new Client({ auth: keys.notionToken });

  let dailySummariesId = "";
  let jobTrackerDbId = "";

  try {
    // Create root page
    const root = await notion.pages.create({
      parent: { type: "workspace", workspace: true } as any,
      properties: {
        title: { title: [{ type: "text", text: { content: "Job Search Agent" } }] },
      },
    });

    // Create Daily Summaries page
    const summaries = await notion.pages.create({
      parent: { page_id: root.id },
      properties: {
        title: { title: [{ type: "text", text: { content: "Daily Summaries" } }] },
      },
    });
    dailySummariesId = summaries.id;

    // Create Job Tracker database
    const db = await notion.databases.create({
      parent: { page_id: root.id },
      title: [{ type: "text", text: { content: "Job Tracker" } }],
      properties: {
        "Job Title": { title: {} },
        "Company": { rich_text: {} },
        "Score": { number: { format: "number" } },
        "Salary": { rich_text: {} },
        "Salary Fit": { select: { options: [
          { name: "unknown", color: "default" },
          { name: "below_floor", color: "red" },
          { name: "at_floor", color: "yellow" },
          { name: "target", color: "green" },
          { name: "stretch", color: "blue" },
        ]}},
        "Source": { select: { options: [] } },
        "Link": { url: {} },
        "Applied": { checkbox: {} },
        "Date Found": { date: {} },
        "Date Applied": { date: {} },
      },
    });
    jobTrackerDbId = db.id;

    console.log("Notion workspace created.");
  } catch (err) {
    console.error("\nNotion setup failed:", err instanceof Error ? err.message : err);
    console.log("You can create the pages manually and set the IDs in your .env file.");
  }

  // --- Write .env ---
  const envLines = [
    `ANTHROPIC_API_KEY=${keys.anthropicKey}`,
    `NOTION_TOKEN=${keys.notionToken}`,
    `NOTION_DAILY_SUMMARIES_PAGE_ID=${dailySummariesId}`,
    `NOTION_JOB_TRACKER_DB_ID=${jobTrackerDbId}`,
    `ADZUNA_APP_ID=${keys.adzunaId ?? ""}`,
    `ADZUNA_APP_KEY=${keys.adzunaKey ?? ""}`,
  ];

  writeFileSync(ENV_PATH, envLines.join("\n") + "\n");
  console.log(".env created.\n");

  // --- GitHub Actions guidance ---
  console.log("Setup complete. Next steps:\n");
  console.log("1. Test locally:       npm run dev");
  console.log("2. Push to GitHub:     git push");
  console.log("3. Add secrets to GitHub (Settings → Secrets and variables → Actions):");
  console.log("   ANTHROPIC_API_KEY");
  console.log("   NOTION_TOKEN");
  console.log(`   NOTION_DAILY_SUMMARIES_PAGE_ID = ${dailySummariesId || "(see .env)"}`);
  console.log(`   NOTION_JOB_TRACKER_DB_ID       = ${jobTrackerDbId || "(see .env)"}`);
  if (keys.adzunaId) {
    console.log("   ADZUNA_APP_ID");
    console.log("   ADZUNA_APP_KEY");
  }
  console.log("\nThe agent will run automatically every day at 6AM ET once secrets are set.");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
