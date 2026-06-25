import { gscSources } from "./config/sources";
import { exportDatasetsToCsv } from "./exporters/csvExporter";
import { writeCombinedAnalysis } from "./reports/combinedAnalysis";
import {
  buildReportData,
  writeMarkdownReport,
} from "./reports/markdownReport";
import { updateIdeaFiles } from "./reports/ideaUpdater";
import {
  loadYearlyDatasets,
  mergeSourceDatasets,
} from "./storage/yearlyDatasets";
import { GscDatasetResults, GscSource, RunKind } from "./types";
import {
  buildCombinedPaths,
  buildCombinedYearlyRawDir,
  buildOutputPaths,
} from "./utils/fileUtils";
import { buildNonBrandedDatasets } from "./utils/queryFilters";

export async function writeOutputs(
  source: GscSource,
  datasets: GscDatasetResults,
  vaultPath: string,
  kind: RunKind,
  label: string,
): Promise<void> {
  const outputPaths = buildOutputPaths(vaultPath, source.id, kind, label);
  const totalRows = Object.values(datasets).reduce(
    (sum, rows) => sum + rows.length,
    0,
  );
  if (totalRows === 0) {
    console.warn(
      `  No rows returned for ${source.id} ${label}; writing auditable empty outputs.`,
    );
  }

  await exportDatasetsToCsv(datasets, outputPaths.rawDir);
  await exportDatasetsToCsv(
    buildNonBrandedDatasets(datasets, source),
    outputPaths.rawDir,
    "non-branded-",
  );
  const report = buildReportData(datasets, label, source);
  writeMarkdownReport(report, outputPaths.reportPath);
  updateIdeaFiles(report, outputPaths.ideasDir);

  console.log(`  Wrote ${outputPaths.rawDir}`);
}

export async function rebuildYearlyOutputs(
  vaultPath: string,
  years: string[],
): Promise<void> {
  for (const year of years) {
    const available: Array<{
      source: GscSource;
      datasets: GscDatasetResults;
    }> = [];

    for (const source of gscSources) {
      const datasets = loadYearlyDatasets(vaultPath, source, year);
      if (!datasets) {
        continue;
      }
      available.push({ source, datasets });
      await writeOutputs(source, datasets, vaultPath, "yearly", year);
    }

    if (available.length === 0) {
      continue;
    }

    const combinedDatasets = mergeSourceDatasets(
      available.map(({ datasets }) => datasets),
    );
    const combinedNonBranded = mergeSourceDatasets(
      available.map(({ source, datasets }) =>
        buildNonBrandedDatasets(datasets, source),
      ),
    );
    const combinedRawDir = buildCombinedYearlyRawDir(vaultPath, year);
    await exportDatasetsToCsv(combinedDatasets, combinedRawDir);
    await exportDatasetsToCsv(
      combinedNonBranded,
      combinedRawDir,
      "non-branded-",
    );

    const combinedPaths = buildCombinedPaths(vaultPath);
    writeCombinedAnalysis(
      available.map(({ source, datasets }) =>
        buildReportData(datasets, year, source),
      ),
      year,
      combinedPaths.reportsDir,
      combinedPaths.ideasDir,
    );
    console.log(`  Rebuilt combined yearly dataset for ${year}`);
  }
}
