export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  description: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  postedAt?: string;
  source: string;
  tags?: string[];
}

export interface ScoredJob extends Job {
  score: number;
  reasoning: string;
  salaryFit: "below_floor" | "at_floor" | "target" | "stretch" | "unknown";
}

export interface RunSummary {
  runAt: string;
  sourcesSearched: string[];
  totalFound: number;
  totalScored: number;
  topMatches: ScoredJob[];
  errors: { source: string; error: string }[];
  durationMs: number;
}

export interface UserConfig {
  titles: string[];
  titleKeywords: string[];
  excludeTitles: string[];
  salary: {
    floor: number;
    targetMin: number;
    targetMax: number;
    stretch: number;
  };
  seniority: string;
  remote: boolean;
  locations: string[];
  skills: string[];
  industries: {
    target: string[];
    avoid: string[];
  };
  minScore: number;
  greenhouse: Record<string, string>;
  ashby: Record<string, string>;
}
