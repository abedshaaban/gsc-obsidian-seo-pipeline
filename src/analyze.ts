import path from "node:path";
import { getDefaultSource, getGscSources, getSource } from "./config/sources";
import { loadStorageConfig } from "./config/env";
import { DATASETS, aggregateDailyDatasets } from "./gsc/fetchSearchAnalytics";
import { writeCombinedAnalysis } from "./reports/combinedAnalysis";
import { buildReportData, writeMarkdownReport } from "./reports/markdownReport";
import { updateIdeaFiles } from "./reports/ideaUpdater";
import { GscDatasetResults, GscSource, ReportData } from "./types";
import { parseAnalysisArgs } from "./utils/dateUtils";
import { readGscCsv } from "./utils/csvReader";
import { buildCombinedPaths, buildOutputPaths } from "./utils/fileUtils";
import { listStoredDailyDates } from "./storage/yearlyDatasets";

function main(): void {
  try {
    const config = loadStorageConfig();
    const args = parseAnalysisArgs(process.argv.slice(2), config.defaultLookbackDays);
    const sources = args.sourceId
      ? [getSource(args.sourceId)]
      : args.all
        ? getGscSources()
        : [getDefaultSource()];
    const reports: ReportData[] = [];
    const usedDates = new Set<string>();

    for (const source of sources) {
      const dates = args.dateRange?.dates ?? latestAvailableDate(config.obsidianVaultPath, source);
      if (dates.length === 0) {
        console.warn(`No stored daily data found for ${source.id}; skipping.`);
        continue;
      }
      dates.forEach((date) => usedDates.add(date));
      const daily = dates.map((date) => readDailyDatasets(config.obsidianVaultPath, source, date));
      const datasets = aggregateDailyDatasets(daily, dates[0], dates[dates.length - 1]);
      const label = dates.length === 1 ? dates[0] : `${dates[0]}_to_${dates[dates.length - 1]}`;
      const kind = dates.length === 1 ? "daily" : "range";
      const output = buildOutputPaths(config.obsidianVaultPath, source.id, kind, label);
      const report = buildReportData(datasets, label, source);
      writeMarkdownReport(report, output.reportPath);
      updateIdeaFiles(report, output.ideasDir);
      reports.push(report);
      console.log(`Analyzed ${source.label}: ${label}`);
    }

    if (args.all && reports.length > 0) {
      const dates = [...usedDates].sort();
      const label =
        args.dateRange?.label ??
        (dates.length === 1 ? dates[0] : `latest-${dates[0]}_to_${dates[dates.length - 1]}`);
      const combined = buildCombinedPaths(config.obsidianVaultPath);
      const reportPath = writeCombinedAnalysis(
        reports,
        label,
        combined.reportsDir,
        combined.ideasDir,
      );
      console.log(`Combined report: ${reportPath}`);
    }
  } catch (error) {
    console.error("GSC analysis failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function latestAvailableDate(vaultPath: string, source: GscSource): string[] {
  const dates = listStoredDailyDates(vaultPath, source.id);
  return dates.length ? [dates[dates.length - 1]] : [];
}

function readDailyDatasets(vaultPath: string, source: GscSource, date: string): GscDatasetResults {
  const result = {} as GscDatasetResults;
  const dailyDir = path.join(
    vaultPath,
    "SEO",
    "GSC",
    "sources",
    source.id,
    "raw",
    "daily",
    date,
  );
  for (const dataset of DATASETS) {
    result[dataset.name] = readGscCsv(path.join(dailyDir, dataset.filename));
  }
  return result;
}

main();
