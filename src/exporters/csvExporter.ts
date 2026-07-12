import path from "node:path";
import { createObjectCsvWriter } from "csv-writer";
import { DATASETS } from "../gsc/fetchSearchAnalytics";
import { GscDataRow, GscDatasetResults } from "../types";
import { ensureDirectory } from "../utils/fileUtils";

const CSV_HEADERS = [
  { id: "engine", title: "engine" },
  { id: "sourceId", title: "sourceId" },
  { id: "sourceLabel", title: "sourceLabel" },
  { id: "sourceType", title: "sourceType" },
  { id: "query", title: "query" },
  { id: "page", title: "page" },
  { id: "date", title: "date" },
  { id: "country", title: "country" },
  { id: "device", title: "device" },
  { id: "clicks", title: "clicks" },
  { id: "impressions", title: "impressions" },
  { id: "ctr", title: "ctr" },
  { id: "position", title: "position" },
  { id: "startDate", title: "startDate" },
  { id: "endDate", title: "endDate" },
];

export async function exportDatasetsToCsv(
  datasets: GscDatasetResults,
  outputDir: string,
  filenamePrefix = "",
): Promise<string[]> {
  ensureDirectory(outputDir);
  const writtenFiles: string[] = [];

  for (const dataset of DATASETS) {
    const filePath = path.join(outputDir, `${filenamePrefix}${dataset.filename}`);
    await writeCsv(filePath, datasets[dataset.name]);
    writtenFiles.push(filePath);
  }

  return writtenFiles;
}

async function writeCsv(filePath: string, rows: GscDataRow[]): Promise<void> {
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: CSV_HEADERS,
    alwaysQuote: false,
  });

  await csvWriter.writeRecords(rows.map(toCsvRecord));
}

function toCsvRecord(row: GscDataRow): Record<string, string | number> {
  return {
    engine: row.engine,
    sourceId: row.sourceId,
    sourceLabel: row.sourceLabel,
    sourceType: row.sourceType,
    query: row.query ?? "",
    page: row.page ?? "",
    date: row.date ?? "",
    country: row.country ?? "",
    device: row.device ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
    startDate: row.startDate,
    endDate: row.endDate,
  };
}
