import fs from "node:fs";
import path from "node:path";
import { GscDataRow, IdeaEntry, ReportData } from "../types";
import { ensureDirectory } from "../utils/fileUtils";

export function writeCombinedAnalysis(
  reports: ReportData[],
  label: string,
  reportsDir: string,
  ideasDir: string,
): string {
  ensureDirectory(reportsDir);
  ensureDirectory(ideasDir);
  const allRows = reports.flatMap((report) => report.queryPages);
  const rows = reports
    .flatMap((report) => report.rankingOpportunities)
    .sort(sortByOpportunity);
  const lowCtrRows = reports
    .flatMap((report) => report.lowCtrOpportunities)
    .sort(sortByOpportunity);
  const ideas = reports
    .flatMap((report) => report.blogIdeas)
    .sort(sortIdeasByOpportunity);
  const quickWins = reports
    .flatMap((report) => report.quickWins)
    .sort(sortIdeasByOpportunity);
  const migration = buildMigrationEntries(allRows);
  const sharedQueries = buildSharedQueries(allRows);
  const internalLinks = buildInternalLinks(allRows);
  const cannibalization = buildCannibalization(allRows);
  const reportPath = path.join(reportsDir, `${label}.md`);

  fs.writeFileSync(
    reportPath,
    [
      `# Combined GSC Report — ${label}`,
      "",
      `Sources: ${reports.map((report) => report.source.label).join(", ")}`,
      "",
      "## Source summary",
      "| Source | Clicks | Impressions | CTR | Position |",
      "| --- | ---: | ---: | ---: | ---: |",
      ...reports.map(
        ({ source, summary }) =>
          `| ${source.label} | ${integer(summary.totalClicks)} | ${integer(summary.totalImpressions)} | ${percent(summary.averageCtr)} | ${summary.averagePosition.toFixed(1)} |`,
      ),
      "",
      "## Cross-source low CTR opportunities",
      renderRows(lowCtrRows.slice(0, 50)),
      "",
      "## Cross-source ranking opportunities",
      renderRows(rows.slice(0, 50)),
      "",
      "## Queries shared by main and content sources",
      sharedQueries.length
        ? sharedQueries.map((item) => `- ${item}`).join("\n")
        : "_No shared main/content queries found._",
      "",
      "## Cannibalization signals",
      cannibalization.length ? cannibalization.map((item) => `- ${item}`).join("\n") : "_No cross-source overlaps found._",
      "",
    ].join("\n"),
    "utf8",
  );

  writeIdeas(path.join(ideasDir, "global-blog-ideas.md"), "Global Blog Ideas", ideas);
  writeIdeas(path.join(ideasDir, "global-quick-wins.md"), "Global Quick Wins", quickWins);
  writeIdeas(path.join(ideasDir, "migration-opportunities.md"), "Migration Opportunities", migration);
  writeTextIdeas(
    path.join(ideasDir, "blog-to-main-internal-links.md"),
    "Blog-to-Main Internal Links",
    internalLinks,
  );
  writeTextIdeas(path.join(ideasDir, "cannibalization.md"), "Cannibalization", cannibalization);
  return reportPath;
}

function buildSharedQueries(rows: GscDataRow[]): string[] {
  const byQuery = groupByQuery(rows);
  return [...byQuery.entries()]
    .flatMap(([query, matches]) => {
      const mainPages = uniquePages(matches.filter((row) => row.sourceType === "main"));
      const blogPages = uniquePages(matches.filter((row) => row.sourceType === "blog"));
      if (!mainPages.length || !blogPages.length) return [];
      return [
        `"${query}" appears on main (${mainPages.join(", ")}) and blog (${blogPages.join(", ")}).`,
      ];
    })
    .slice(0, 100);
}

function buildInternalLinks(rows: GscDataRow[]): string[] {
  const blogRows = rows.filter((row) => row.sourceType === "blog" && row.query);
  const mainByQuery = bestRowByQuery(
    rows.filter((row) => row.sourceType === "main" && row.query && row.page),
  );
  return blogRows.flatMap((blogRow) => {
    const mainRow = mainByQuery.get(normalizeQuery(blogRow.query ?? ""));
    if (!mainRow?.page || !blogRow.page) {
      return [];
    }
    return [
      `Link from ${blogRow.page} to ${mainRow.page} for the shared query "${blogRow.query}".`,
    ];
  });
}

function buildCannibalization(rows: GscDataRow[]): string[] {
  const bySignature = new Map<string, GscDataRow[]>();
  for (const row of rows) {
    if (!row.query || !row.page) continue;
    const signature = querySignature(row.query);
    if (!signature) continue;
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), row]);
  }

  return [...bySignature.values()].flatMap((matches) => {
    const uniqueTargets = new Set(matches.map((row) => `${row.sourceId}:${row.page}`));
    if (uniqueTargets.size < 2) return [];
    const queries = [...new Set(matches.flatMap((row) => (row.query ? [row.query] : [])))];
    const queryLabel = queries.length === 1 ? `"${queries[0]}"` : `similar queries (${queries.map((query) => `"${query}"`).join(", ")})`;
    const verb = queries.length === 1 ? "appears" : "appear";
    return [
      `${queryLabel} ${verb} across ${[...uniqueTargets].join(", ")}. Review intent, canonical ownership, and internal linking.`,
    ];
  });
}

function buildMigrationEntries(rows: GscDataRow[]): IdeaEntry[] {
  return rows
    .filter((row) => row.sourceType === "legacy" && row.query && row.page)
    .sort((a, b) => b.impressions - a.impressions || a.position - b.position)
    .slice(0, 100)
    .map((row) => ({
      sourceId: row.sourceId,
      sourceLabel: row.sourceLabel,
      sourceType: row.sourceType,
      query: row.query ?? "",
      page: row.page ?? "",
      whyItMatters: `${integer(row.impressions)} legacy impressions at average position ${row.position.toFixed(1)}.`,
      suggestedIdea: `Map ${row.page} to the best current destination, or recreate a page for "${row.query}" before adding a redirect.`,
      priority: row.impressions >= 1_000 ? "High" : row.impressions >= 250 ? "Medium" : "Low",
      source: "Legacy migration analysis",
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      startDate: row.startDate,
      endDate: row.endDate,
    }));
}

function groupByQuery(rows: GscDataRow[]): Map<string, GscDataRow[]> {
  const byQuery = new Map<string, GscDataRow[]>();
  for (const row of rows) {
    if (!row.query || !row.page) continue;
    const key = normalizeQuery(row.query);
    byQuery.set(key, [...(byQuery.get(key) ?? []), row]);
  }
  return byQuery;
}

function bestRowByQuery(rows: GscDataRow[]): Map<string, GscDataRow> {
  const result = new Map<string, GscDataRow>();
  for (const row of rows) {
    const key = normalizeQuery(row.query ?? "");
    const current = result.get(key);
    if (!current || row.impressions > current.impressions) {
      result.set(key, row);
    }
  }
  return result;
}

function uniquePages(rows: GscDataRow[]): string[] {
  return [...new Set(rows.flatMap((row) => (row.page ? [row.page] : [])))];
}

function writeIdeas(filePath: string, title: string, entries: IdeaEntry[]): void {
  const seen = new Set<string>();
  const blocks = entries.flatMap((entry) => {
    const key = `${entry.sourceId}\u0000${entry.query}\u0000${entry.page}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      [
        `## ${entry.query}`,
        `- Source: ${entry.sourceLabel} (${entry.sourceId})`,
        `- Page: ${entry.page}`,
        `- Why it matters: ${entry.whyItMatters}`,
        `- Suggested action: ${entry.suggestedIdea}`,
        `- Priority: ${entry.priority}`,
      ].join("\n"),
    ];
  });
  fs.writeFileSync(filePath, [`# ${title}`, "", ...blocks].join("\n\n").trimEnd() + "\n", "utf8");
}

function writeTextIdeas(filePath: string, title: string, entries: string[]): void {
  const unique = [...new Set(entries)];
  fs.writeFileSync(
    filePath,
    [`# ${title}`, "", ...(unique.length ? unique.map((entry) => `- ${entry}`) : ["_No matching opportunities._"])].join("\n") + "\n",
    "utf8",
  );
}

function renderRows(rows: GscDataRow[]): string {
  if (!rows.length) return "_No matching rows._";
  return [
    "| Source | Query | Page | Impressions | CTR | Position |",
    "| --- | --- | --- | ---: | ---: | ---: |",
    ...rows.map(
      (row) =>
        `| ${row.sourceLabel} | ${escapeTable(row.query ?? "")} | ${escapeTable(row.page ?? "")} | ${integer(row.impressions)} | ${percent(row.ctr)} | ${row.position.toFixed(1)} |`,
    ),
  ].join("\n");
}

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

function querySignature(query: string): string {
  const stopWords = new Set(["a", "an", "and", "for", "in", "of", "on", "the", "to"]);
  return normalizeQuery(query)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token && !stopWords.has(token))
    .map((token) => (token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token))
    .sort()
    .join(" ");
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function integer(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function sortByOpportunity(a: GscDataRow, b: GscDataRow): number {
  return b.impressions - a.impressions || a.position - b.position;
}

function sortIdeasByOpportunity(a: IdeaEntry, b: IdeaEntry): number {
  return b.impressions - a.impressions || a.position - b.position;
}
