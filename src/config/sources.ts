import { GscSource } from "../types";

const APELR_BRAND_QUERY_REGEX =
  String.raw`\b(?:apelr|apeolr|apelor|apleor|apler|aperl|aepolar|aperol|aploer|aplore|apealor|apeoler|aplr|apoelr|apeir|apeljr|apeor|aplor|apoler)\b`;

export const gscSources: GscSource[] = [
  {
    id: "apelr",
    label: "Apelr Main Domain",
    siteUrl: "sc-domain:apelr.com",
    type: "main",
    enabled: true,
    brandQueryRegex: APELR_BRAND_QUERY_REGEX,
    pageFilters: [
      {
        operator: "notContains",
        expression: "https://blog.apelr.com/",
      },
    ],
  },
  {
    id: "blog-apelr",
    label: "Apelr Blog",
    siteUrl: "sc-domain:apelr.com",
    type: "blog",
    enabled: true,
    brandQueryRegex: APELR_BRAND_QUERY_REGEX,
    pageFilters: [
      {
        operator: "contains",
        expression: "https://blog.apelr.com/",
      },
    ],
  },
  {
    id: "old-domain",
    label: "Apeolr Legacy Domain",
    siteUrl: "sc-domain:apeolr.com",
    type: "legacy",
    enabled: true,
    brandQueryRegex: APELR_BRAND_QUERY_REGEX,
  },
];

export function getSource(sourceId: string): GscSource {
  const source = gscSources.find((candidate) => candidate.id === sourceId);
  if (!source) {
    throw new Error(
      `Unknown GSC source "${sourceId}". Available sources: ${gscSources.map(({ id }) => id).join(", ")}`,
    );
  }

  return source;
}

export function validateSource(source: GscSource): void {
  if (
    !source.siteUrl.startsWith("http://") &&
    !source.siteUrl.startsWith("https://") &&
    !source.siteUrl.startsWith("sc-domain:")
  ) {
    throw new Error(`Invalid siteUrl for source "${source.id}": ${source.siteUrl}`);
  }

  if (source.siteUrl.includes("REPLACE_")) {
    throw new Error(
      `Source "${source.id}" still uses a placeholder siteUrl. Update src/config/sources.ts first.`,
    );
  }

  if (source.brandQueryRegex) {
    try {
      new RegExp(source.brandQueryRegex, "iu");
    } catch (error) {
      throw new Error(
        `Invalid brandQueryRegex for source "${source.id}". ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  for (const filter of source.pageFilters ?? []) {
    if (!filter.expression.trim()) {
      throw new Error(
        `Source "${source.id}" has a page filter with an empty expression.`,
      );
    }
  }
}
