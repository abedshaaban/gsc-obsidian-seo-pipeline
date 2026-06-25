import fs from "node:fs";
import path from "node:path";
import {
  GscDataRow,
  GscDatasetResults,
  GscSource,
  IdeaEntry,
  ReportData,
  ReportSummary,
} from "../types";
import { ensureDirectory } from "../utils/fileUtils";
import { filterNonBrandedRows } from "../utils/queryFilters";

export function buildReportData(
  datasets: GscDatasetResults,
  titleDate: string,
  source: GscSource,
): ReportData {
  const pages = datasets.pages ?? [];
  const queries = datasets.queries ?? [];
  const queryPages = datasets["query-page"] ?? [];
  const nonBrandedQueries = filterNonBrandedRows(queries, source);
  const nonBrandedQueryPages = filterNonBrandedRows(queryPages, source);

  const lowCtrOpportunities = nonBrandedQueryPages
    .filter((row) => row.impressions >= 100 && row.ctr < 0.02)
    .sort(sortByOpportunity)
    .slice(0, 50);

  const rankingOpportunities = nonBrandedQueryPages
    .filter((row) => row.position >= 5 && row.position <= 20 && row.impressions >= 50)
    .sort(sortByOpportunity)
    .slice(0, 50);

  const blogIdeas = toIdeaEntries(
    mergeUniqueRows([...lowCtrOpportunities, ...rankingOpportunities]).slice(0, 25),
    "Blog idea",
    source,
  );
  const quickWins = toIdeaEntries(
    rankingOpportunities
      .filter((row) => row.position <= 12)
      .slice(0, 25),
    "Quick win",
    source,
  );

  return {
    titleDate,
    source,
    summary: summarize(pages),
    queryPages,
    topQueries: queries.sort((a, b) => b.clicks - a.clicks).slice(0, 25),
    topNonBrandedQueries: nonBrandedQueries
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 25),
    lowCtrOpportunities,
    rankingOpportunities,
    blogIdeas,
    quickWins,
  };
}

export function writeMarkdownReport(report: ReportData, reportPath: string): void {
  ensureDirectory(path.dirname(reportPath));
  fs.writeFileSync(reportPath, renderMarkdownReport(report), "utf8");
}

export function renderMarkdownReport(report: ReportData): string {
  return [
    `# GSC Report — ${report.source.label} — ${report.titleDate}`,
    "",
    "## Summary",
    `- Total clicks: ${formatInteger(report.summary.totalClicks)}`,
    `- Total impressions: ${formatInteger(report.summary.totalImpressions)}`,
    `- Average CTR: ${formatPercent(report.summary.averageCtr)}`,
    `- Average position: ${formatDecimal(report.summary.averagePosition)}`,
    "",
    "## Top Queries",
    renderRowsTable(report.topQueries, ["query", "clicks", "impressions", "ctr", "position"]),
    "",
    "## Top Non-Branded Queries",
    report.source.brandQueryRegex
      ? `Excluded query regex: \`${report.source.brandQueryRegex}\``
      : "_No brand query regex configured; this matches Top Queries._",
    "",
    renderRowsTable(report.topNonBrandedQueries, [
      "query",
      "clicks",
      "impressions",
      "ctr",
      "position",
    ]),
    "",
    "## High Impression / Low CTR Opportunities",
    renderRowsTable(report.lowCtrOpportunities.slice(0, 25), [
      "query",
      "page",
      "clicks",
      "impressions",
      "ctr",
      "position",
    ]),
    "",
    "## Ranking 5-20 Opportunities",
    renderRowsTable(report.rankingOpportunities.slice(0, 25), [
      "query",
      "page",
      "clicks",
      "impressions",
      "ctr",
      "position",
    ]),
    "",
    "## Blog Post Ideas for AI",
    renderIdeaEntries(report.blogIdeas),
    "",
    "## Source-specific recommendations",
    ...sourceRecommendations(report.source.type).map((item) => `- ${item}`),
    "",
  ].join("\n");
}

function summarize(rows: GscDataRow[]): ReportSummary {
  const totalClicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const totalImpressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const weightedPosition = rows.reduce(
    (sum, row) => sum + row.position * row.impressions,
    0,
  );

  return {
    totalClicks,
    totalImpressions,
    averageCtr: totalImpressions === 0 ? 0 : totalClicks / totalImpressions,
    averagePosition: totalImpressions === 0 ? 0 : weightedPosition / totalImpressions,
  };
}

function toIdeaEntries(rows: GscDataRow[], origin: string, source: GscSource): IdeaEntry[] {
  return rows
    .filter((row) => row.query && row.page)
    .map((row) => ({
      sourceId: source.id,
      sourceLabel: source.label,
      sourceType: source.type,
      query: row.query ?? "",
      page: row.page ?? "",
      whyItMatters: buildWhyItMatters(row),
      suggestedIdea: buildSuggestedIdea(row, source),
      priority: getPriority(row),
      source: origin,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      startDate: row.startDate,
      endDate: row.endDate,
    }));
}

function buildWhyItMatters(row: GscDataRow): string {
  const ctrNote = row.ctr < 0.02 ? "low CTR" : "existing ranking traction";
  return `${formatInteger(row.impressions)} impressions with ${ctrNote} at average position ${formatDecimal(row.position)}.`;
}

function buildSuggestedIdea(row: GscDataRow, source: GscSource): string {
  const query = row.query ?? "this query";
  if (source.type === "blog") {
    return `Update or create an informational post for "${query}" and add a relevant internal link to an Apelr exam or document page.`;
  }
  if (source.type === "legacy") {
    return `Evaluate "${query}" for a redirect, migration, or replacement page on the current Apelr domain.`;
  }
  return `Improve the exam or landing page for "${query}", including its title and links from relevant blog content.`;
}

function getPriority(row: GscDataRow): IdeaEntry["priority"] {
  if (row.impressions >= 1_000 && (row.ctr < 0.015 || row.position <= 10)) {
    return "High";
  }

  if (row.impressions >= 250) {
    return "Medium";
  }

  return "Low";
}

function sourceRecommendations(sourceType: GscSource["type"]): string[] {
  if (sourceType === "blog") {
    return [
      "Prioritize informational queries and useful blog post ideas.",
      "Link relevant posts to Apelr main exam and document pages.",
      "Update existing posts that already have ranking traction.",
    ];
  }
  if (sourceType === "legacy") {
    return [
      "Identify redirect and migration opportunities.",
      "Find old pages that deserve replacement pages on Apelr.",
      "Preserve keywords that remain valuable on the legacy domain.",
    ];
  }
  return [
    "Prioritize exam and high-intent landing pages.",
    "Improve titles on high-impression pages with low CTR.",
    "Add internal links from relevant blog posts to main pages.",
    "Create focused landing pages where valuable queries do not have a strong destination.",
  ];
}

function sortByOpportunity(a: GscDataRow, b: GscDataRow): number {
  if (b.impressions !== a.impressions) {
    return b.impressions - a.impressions;
  }

  return a.position - b.position;
}

function mergeUniqueRows(rows: GscDataRow[]): GscDataRow[] {
  const seen = new Set<string>();
  const uniqueRows: GscDataRow[] = [];

  for (const row of rows) {
    const key = `${row.query ?? ""}::${row.page ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRows.push(row);
    }
  }

  return uniqueRows;
}

function renderRowsTable(rows: GscDataRow[], columns: Array<keyof GscDataRow>): string {
  if (rows.length === 0) {
    return "_No matching rows._";
  }

  const header = `| ${columns.join(" |")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => {
    const cells = columns.map((column) => formatCell(row[column], column));
    return `| ${cells.join(" | ")} |`;
  });

  return [header, separator, ...body].join("\n");
}

function renderIdeaEntries(entries: IdeaEntry[]): string {
  if (entries.length === 0) {
    return "_No blog ideas matched the current thresholds._";
  }

  return entries
    .map(
      (entry) => [
        `### ${entry.query}`,
        `- Query: ${entry.query}`,
        `- Ranking page: ${entry.page}`,
        `- Why it matters: ${entry.whyItMatters}`,
        `- Suggested blog/page idea: ${entry.suggestedIdea}`,
        `- Priority: ${entry.priority}`,
      ].join("\n"),
    )
    .join("\n\n");
}

function formatCell(value: GscDataRow[keyof GscDataRow], column: keyof GscDataRow): string {
  if (value === undefined || value === "") {
    return "";
  }

  if (column === "ctr" && typeof value === "number") {
    return formatPercent(value);
  }

  if (column === "position" && typeof value === "number") {
    return formatDecimal(value);
  }

  if (typeof value === "number") {
    return formatInteger(value);
  }

  return escapeMarkdownTable(value);
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatInteger(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatDecimal(value: number): string {
  return value.toFixed(1);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
