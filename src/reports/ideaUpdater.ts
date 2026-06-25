import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { GscSource, IdeaEntry, ReportData } from "../types";
import { ensureDirectory } from "../utils/fileUtils";

interface IdeaFileConfig {
  filename: string;
  title: string;
  description: string;
  entries: IdeaEntry[];
}

export function updateIdeaFiles(report: ReportData, ideasDir: string): string[] {
  ensureDirectory(ideasDir);

  const files: IdeaFileConfig[] = [
    {
      filename: "blog-ideas.md",
      title: "GSC Blog Ideas",
      description: "AI-ready content ideas generated from Google Search Console query/page data.",
      entries: report.blogIdeas,
    },
    {
      filename: "quick-wins.md",
      title: "GSC Quick Wins",
      description: "Pages already ranking close to page one that may benefit from focused updates.",
      entries: report.quickWins,
    },
    {
      filename: "low-ctr.md",
      title: "GSC Low CTR Opportunities",
      description: "High-impression query/page pairs with low click-through rate.",
      entries: rowsToIdeaEntries(report.lowCtrOpportunities, "Low CTR", report.source),
    },
    {
      filename: "ranking-5-to-20.md",
      title: "GSC Ranking 5-20 Opportunities",
      description: "Query/page pairs ranking between positions 5 and 20 with enough impressions to matter.",
      entries: rowsToIdeaEntries(report.rankingOpportunities, "Ranking 5-20", report.source),
    },
  ];

  return files.map((file) => {
    const filePath = path.join(ideasDir, file.filename);
    updateIdeaFile(filePath, file);
    return filePath;
  });
}

function updateIdeaFile(filePath: string, config: IdeaFileConfig): void {
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : initialIdeaFile(config.title, config.description);
  let content = existing.trimEnd();
  const existingKeys = new Set([...content.matchAll(/<!-- gsc-key: ([A-Za-z0-9_-]+) -->/g)].map((match) => match[1]));

  for (const entry of config.entries) {
    const key = ideaKey(entry);
    const block = renderIdeaBlock(key, entry);
    const blockPattern = new RegExp(
      `<!-- gsc-key: ${escapeRegExp(key)} -->[\\s\\S]*?<!-- /gsc-key -->`,
      "m",
    );

    if (existingKeys.has(key)) {
      content = content.replace(blockPattern, block);
    } else {
      content = `${content}\n\n${block}`;
    }
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, "utf8");
}

function initialIdeaFile(title: string, description: string): string {
  return [`# ${title}`, "", description, "", "Entries use `sourceId + query + page` as the unique key."].join("\n");
}

function rowsToIdeaEntries(
  rows: ReportData["lowCtrOpportunities"],
  origin: string,
  source: GscSource,
): IdeaEntry[] {
  return rows
    .filter((row) => row.query && row.page)
    .slice(0, 50)
    .map((row) => ({
      sourceId: source.id,
      sourceLabel: source.label,
      sourceType: source.type,
      query: row.query ?? "",
      page: row.page ?? "",
      whyItMatters: `${row.impressions.toLocaleString("en-US")} impressions, ${(row.ctr * 100).toFixed(2)}% CTR, average position ${row.position.toFixed(1)}.`,
      suggestedIdea: `Review the ranking page for intent match, title/meta clarity, headings, and internal links for "${row.query}".`,
      priority: row.impressions >= 1_000 ? "High" : row.impressions >= 250 ? "Medium" : "Low",
      source: origin,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      startDate: row.startDate,
      endDate: row.endDate,
    }));
}

function renderIdeaBlock(key: string, entry: IdeaEntry): string {
  return [
    `<!-- gsc-key: ${key} -->`,
    `## ${entry.query}`,
    `- Query: ${entry.query}`,
    `- Ranking page: ${entry.page}`,
    `- GSC source: ${entry.sourceLabel} (${entry.sourceId})`,
    `- Why it matters: ${entry.whyItMatters}`,
    `- Suggested blog/page idea: ${entry.suggestedIdea}`,
    `- Priority: ${entry.priority}`,
    `- Source: ${entry.source}`,
    `- Metrics: ${entry.clicks.toLocaleString("en-US")} clicks, ${entry.impressions.toLocaleString("en-US")} impressions, ${(entry.ctr * 100).toFixed(2)}% CTR, position ${entry.position.toFixed(1)}`,
    `- Date range: ${entry.startDate} to ${entry.endDate}`,
    "<!-- /gsc-key -->",
  ].join("\n");
}

function ideaKey(entry: IdeaEntry): string {
  return crypto
    .createHash("sha256")
    .update(`${entry.sourceId}\u0000${entry.query}\u0000${entry.page}`)
    .digest("base64url")
    .slice(0, 32);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
