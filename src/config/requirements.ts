import { readFileSync } from "fs";
import { resolve } from "path";
import type { UserConfig } from "../types.js";

function loadConfig(): UserConfig {
  const configPath = resolve(process.cwd(), "config.json");
  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as UserConfig;
  } catch {
    throw new Error(
      "config.json not found. Run `npm run setup` to create it, or copy config.example.json to config.json and fill it in."
    );
  }
}

export const config = loadConfig();
