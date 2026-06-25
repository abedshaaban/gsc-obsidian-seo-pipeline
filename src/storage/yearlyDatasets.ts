import fs from "node:fs";
import path from "node:path";
import { DATASETS, aggregateDailyDatasets } from "../gsc/fetchSearchAnalytics";
import { GscDatasetResults, GscSource } from "../types";
import { readGscCsv } from "../utils/csvReader";

export function loadYearlyDatasets(
  vaultPath: string,
  source: GscSource,
  year: string,
): GscDatasetResults | undefined {
  const dates = listStoredDailyDates(vaultPath, source.id).filter((date) =>
    date.startsWith(`${year}-`),
  );
  if (dates.length === 0) {
    return undefined;
  }

  const daily = dates.map((date) =>
    readDailyDatasets(vaultPath, source.id, date),
  );
  return aggregateDailyDatasets(daily, dates[0], dates[dates.length - 1]);
}

export function listStoredDailyDates(
  vaultPath: string,
  sourceId: string,
): string[] {
  const dailyDir = path.join(
    vaultPath,
    "SEO",
    "GSC",
    "sources",
    sourceId,
    "raw",
    "daily",
  );
  if (!fs.existsSync(dailyDir)) {
    return [];
  }

  return fs
    .readdirSync(dailyDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort();
}

export function mergeSourceDatasets(
  datasets: GscDatasetResults[],
): GscDatasetResults {
  const merged = {} as GscDatasetResults;
  for (const dataset of DATASETS) {
    merged[dataset.name] = datasets.flatMap((result) => result[dataset.name]);
  }
  return merged;
}

function readDailyDatasets(
  vaultPath: string,
  sourceId: string,
  date: string,
): GscDatasetResults {
  const result = {} as GscDatasetResults;
  const dailyDir = path.join(
    vaultPath,
    "SEO",
    "GSC",
    "sources",
    sourceId,
    "raw",
    "daily",
    date,
  );

  for (const dataset of DATASETS) {
    result[dataset.name] = readGscCsv(
      path.join(dailyDir, dataset.filename),
    );
  }
  return result;
}
