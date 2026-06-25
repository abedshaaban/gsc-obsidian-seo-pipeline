import { searchconsole_v1 } from "googleapis";
import {
  DatasetName,
  GscDataRow,
  GscDatasetConfig,
  GscDatasetResults,
  GscSource,
} from "../types";

const ROW_LIMIT = 25_000;

export const DATASETS: GscDatasetConfig[] = [
  {
    name: "queries",
    filename: "queries.csv",
    dimensions: ["query"],
  },
  {
    name: "pages",
    filename: "pages.csv",
    dimensions: ["page"],
  },
  {
    name: "query-page",
    filename: "query-page.csv",
    dimensions: ["query", "page"],
  },
  {
    name: "query-page-country",
    filename: "query-page-country.csv",
    dimensions: ["query", "page", "country"],
  },
  {
    name: "query-page-device",
    filename: "query-page-device.csv",
    dimensions: ["query", "page", "device"],
  },
  {
    name: "date-query-page",
    filename: "date-query-page.csv",
    dimensions: ["date", "query", "page"],
  },
];

export async function fetchAllSearchAnalytics(
  client: searchconsole_v1.Searchconsole,
  siteUrl: string,
  startDate: string,
  endDate: string,
  source: GscSource,
): Promise<GscDatasetResults> {
  const results = {} as GscDatasetResults;

  for (const dataset of DATASETS) {
    results[dataset.name] = await fetchSearchAnalyticsDataset(
      client,
      siteUrl,
      startDate,
      endDate,
      dataset,
      source,
    );
  }

  return results;
}

export async function fetchSearchAnalyticsDataset(
  client: searchconsole_v1.Searchconsole,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dataset: GscDatasetConfig,
  source: GscSource,
): Promise<GscDataRow[]> {
  const rows: GscDataRow[] = [];
  let startRow = 0;

  while (true) {
    let response;
    try {
      response = await client.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: dataset.dimensions,
          ...(source.pageFilters?.length
            ? {
                dimensionFilterGroups: [
                  {
                    groupType: "and",
                    filters: source.pageFilters.map((filter) => ({
                      dimension: "page",
                      operator: filter.operator,
                      expression: filter.expression,
                    })),
                  },
                ],
              }
            : {}),
          rowLimit: ROW_LIMIT,
          startRow,
        },
      });
    } catch (error) {
      throw new Error(
        `Google Search Console API request failed for source "${source.id}" and dataset "${dataset.name}". Check the source siteUrl, Search Console property access, and API enablement. ${formatError(error)}`,
      );
    }

    const apiRows = response.data.rows ?? [];
    if (apiRows.length === 0) {
      break;
    }

    rows.push(
      ...apiRows.map((row) => normalizeRow(row, dataset, startDate, endDate, source)),
    );
    startRow += ROW_LIMIT;
  }

  return rows;
}

function normalizeRow(
  row: searchconsole_v1.Schema$ApiDataRow,
  dataset: GscDatasetConfig,
  startDate: string,
  endDate: string,
  source: GscSource,
): GscDataRow {
  const keys = row.keys ?? [];
  const normalized: GscDataRow = {
    sourceId: source.id,
    sourceLabel: source.label,
    sourceType: source.type,
    clicks: Number(row.clicks ?? 0),
    impressions: Number(row.impressions ?? 0),
    ctr: Number(row.ctr ?? 0),
    position: Number(row.position ?? 0),
    startDate,
    endDate,
  };

  dataset.dimensions.forEach((dimension, index) => {
    const value = keys[index];
    if (value) {
      normalized[dimension] = value;
    }
  });

  return normalized;
}

export function aggregateDailyDatasets(
  dailyDatasets: GscDatasetResults[],
  startDate: string,
  endDate: string,
): GscDatasetResults {
  const results = {} as GscDatasetResults;

  for (const dataset of DATASETS) {
    const rows = dailyDatasets.flatMap((result) => result[dataset.name]);
    if (dataset.name === "date-query-page") {
      results[dataset.name] = rows.map((row) => ({ ...row, startDate, endDate }));
      continue;
    }

    const groups = new Map<string, GscDataRow & { weightedPosition: number }>();
    for (const row of rows) {
      const key = [
        row.sourceId,
        ...dataset.dimensions.map((dimension) => row[dimension] ?? ""),
      ].join("\u0000");
      const existing = groups.get(key);
      if (existing) {
        existing.clicks += row.clicks;
        existing.impressions += row.impressions;
        existing.weightedPosition += row.position * row.impressions;
      } else {
        groups.set(key, {
          ...row,
          startDate,
          endDate,
          weightedPosition: row.position * row.impressions,
        });
      }
    }

    results[dataset.name] = [...groups.values()].map(({ weightedPosition, ...row }) => ({
      ...row,
      ctr: row.impressions === 0 ? 0 : row.clicks / row.impressions,
      position: row.impressions === 0 ? 0 : weightedPosition / row.impressions,
    }));
  }

  return results;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function datasetByName(name: DatasetName): GscDatasetConfig {
  const dataset = DATASETS.find((item) => item.name === name);
  if (!dataset) {
    throw new Error(`Unknown dataset: ${name}`);
  }

  return dataset;
}
