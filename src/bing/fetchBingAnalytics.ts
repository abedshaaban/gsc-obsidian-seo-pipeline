import { DATASETS, aggregateDailyDatasets } from "../gsc/fetchSearchAnalytics";
import { DateRange, GscDataRow, GscDatasetResults, GscSource } from "../types";
import { BingStat, BingWebmasterClient } from "./bingClient";

export async function fetchBingAnalytics(
  client: BingWebmasterClient,
  source: GscSource,
  range: DateRange,
): Promise<{ daily: Map<string, GscDatasetResults>; range: GscDatasetResults }> {
  const [queries, pages] = await Promise.all([
    client.get<BingStat[]>("GetQueryStats", { siteUrl: source.siteUrl }),
    client.get<BingStat[]>("GetPageStats", { siteUrl: source.siteUrl }),
  ]);
  const selectedPages = [...new Set(pages.map((row) => row.Query).filter((value): value is string => Boolean(value)))];
  const pageQueries = await mapConcurrent(selectedPages, 5, async (page) => ({
    page,
    rows: await client.get<BingStat[]>("GetPageQueryStats", { siteUrl: source.siteUrl, page }),
  }));

  const daily = new Map(range.dates.map((date) => [date, emptyResults()]));
  for (const row of queries) add(daily, "queries", normalize(row, source, range));
  for (const row of pages) add(daily, "pages", normalize(row, source, range, undefined, row.Query));
  for (const item of pageQueries) {
    for (const row of item.rows) add(daily, "query-page", normalize(row, source, range, row.Query, item.page));
  }
  for (const [date, result] of daily) {
    result["date-query-page"] = result["query-page"].map((row) => ({ ...row, date }));
  }
  return { daily, range: aggregateDailyDatasets([...daily.values()], range.startDate, range.endDate) };
}

function emptyResults(): GscDatasetResults {
  const result = {} as GscDatasetResults;
  for (const { name } of DATASETS) result[name] = [];
  return result;
}

function add(results: Map<string, GscDatasetResults>, name: "queries" | "pages" | "query-page", row?: GscDataRow): void {
  if (row?.date && results.has(row.date)) results.get(row.date)?.[name].push(row);
}

function normalize(row: BingStat, source: GscSource, range: DateRange, query = row.Query, page?: string): GscDataRow | undefined {
  const date = parseBingDate(row.Date);
  if (!date || date < range.startDate || date > range.endDate) return undefined;
  const clicks = Number(row.Clicks ?? 0);
  const impressions = Number(row.Impressions ?? 0);
  return {
    engine: "bing", sourceId: source.id, sourceLabel: source.label, sourceType: source.type,
    query, page, date, clicks, impressions, ctr: impressions ? clicks / impressions : 0,
    position: Number(row.AvgImpressionPosition ?? row.AvgClickPosition ?? 0),
    startDate: date, endDate: date,
  };
}

function parseBingDate(value?: string): string | undefined {
  if (!value) return undefined;
  const match = /\/Date\((\d+)(?:[+-]\d+)?\)\//.exec(value);
  const date = match ? new Date(Number(match[1])) : new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString().slice(0, 10);
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; output[index] = await fn(items[index]); }
  }));
  return output;
}
