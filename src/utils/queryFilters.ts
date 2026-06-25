import { GscDataRow, GscDatasetResults, GscSource } from "../types";

export function isBrandedQuery(query: string | undefined, source: GscSource): boolean {
  if (!query || !source.brandQueryRegex) {
    return false;
  }

  return new RegExp(source.brandQueryRegex, "iu").test(query);
}

export function filterNonBrandedRows(
  rows: GscDataRow[],
  source: GscSource,
): GscDataRow[] {
  return rows.filter((row) => !isBrandedQuery(row.query, source));
}

export function buildNonBrandedDatasets(
  datasets: GscDatasetResults,
  source: GscSource,
): GscDatasetResults {
  return {
    queries: filterNonBrandedRows(datasets.queries, source),
    pages: datasets.pages,
    "query-page": filterNonBrandedRows(datasets["query-page"], source),
    "query-page-country": filterNonBrandedRows(
      datasets["query-page-country"],
      source,
    ),
    "query-page-device": filterNonBrandedRows(
      datasets["query-page-device"],
      source,
    ),
    "date-query-page": filterNonBrandedRows(
      datasets["date-query-page"],
      source,
    ),
  };
}
