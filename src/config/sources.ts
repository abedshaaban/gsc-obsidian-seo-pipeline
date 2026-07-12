import fs from "node:fs";
import path from "node:path";
import { GscPageFilter, GscSource } from "../types";

interface GscSourcesFile {
  sources: GscSource[];
}

const DEFAULT_SOURCES_CONFIG_PATH = "gsc-sources.json";

let cachedSources: GscSource[] | undefined;

export function getGscSources(): GscSource[] {
  cachedSources ??= loadSources();
  return cachedSources;
}

export function getSource(sourceId: string): GscSource {
  const gscSources = getGscSources();
  const source = gscSources.find((candidate) => candidate.id === sourceId);
  if (!source) {
    throw new Error(
      `Unknown GSC source "${sourceId}". Available sources: ${formatSourceIds()}`,
    );
  }

  return source;
}

export function getDefaultSource(): GscSource {
  const gscSources = getGscSources();
  const source = gscSources.find((candidate) => candidate.enabled) ?? gscSources[0];
  if (!source) {
    throw new Error("No GSC sources are configured.");
  }

  return source;
}

export function validateSource(source: GscSource): void {
  if (!source.id.trim()) {
    throw new Error("Every GSC source needs a non-empty id.");
  }

  if (!source.label.trim()) {
    throw new Error(`Source "${source.id}" needs a non-empty label.`);
  }

  if (!source.type.trim()) {
    throw new Error(`Source "${source.id}" needs a non-empty type.`);
  }

  if (
    !source.siteUrl.startsWith("http://") &&
    !source.siteUrl.startsWith("https://") &&
    !source.siteUrl.startsWith("sc-domain:")
  ) {
    throw new Error(`Invalid siteUrl for source "${source.id}": ${source.siteUrl}`);
  }

  if (source.siteUrl.includes("example.")) {
    throw new Error(
      `Source "${source.id}" still uses an example siteUrl. Update ${getSourcesConfigPath()} first.`,
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

function loadSources(): GscSource[] {
  const configPath = getSourcesConfigPath();
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Missing GSC sources config at ${configPath}. Copy gsc-sources.example.json to gsc-sources.json, then add your own Search Console properties.`,
    );
  }

  const parsed = parseSourcesFile(configPath);
  const sources = Array.isArray(parsed) ? parsed : parsed.sources;
  sources.forEach(validateSource);
  ensureUniqueSourceIds(sources);
  return sources;
}

function getSourcesConfigPath(): string {
  return path.resolve(process.cwd(), process.env.GSC_SOURCES_CONFIG ?? DEFAULT_SOURCES_CONFIG_PATH);
}

function parseSourcesFile(configPath: string): GscSourcesFile | GscSource[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read GSC sources config at ${configPath}. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (Array.isArray(parsed)) {
    return parsed.map(normalizeSource);
  }

  if (isRecord(parsed) && Array.isArray(parsed.sources)) {
    return {
      sources: parsed.sources.map(normalizeSource),
    };
  }

  throw new Error(
    `Invalid GSC sources config at ${configPath}. Expected {"sources": [...]} or a source array.`,
  );
}

function normalizeSource(value: unknown): GscSource {
  if (!isRecord(value)) {
    throw new Error("Each GSC source must be an object.");
  }

  const pageFilters = value.pageFilters;
  return {
    engine: "google",
    id: readString(value, "id"),
    label: readString(value, "label"),
    siteUrl: readString(value, "siteUrl"),
    type: readString(value, "type"),
    enabled: value.enabled === undefined ? true : readBoolean(value, "enabled"),
    brandQueryRegex: readOptionalString(value, "brandQueryRegex"),
    pageFilters: pageFilters === undefined ? undefined : normalizePageFilters(pageFilters),
  };
}

function normalizePageFilters(value: unknown): GscPageFilter[] {
  if (!Array.isArray(value)) {
    throw new Error("pageFilters must be an array when provided.");
  }

  return value.map((filter) => {
    if (!isRecord(filter)) {
      throw new Error("Each page filter must be an object.");
    }

    const operator = readString(filter, "operator");
    if (!["contains", "equals", "notContains", "notEquals"].includes(operator)) {
      throw new Error(`Invalid page filter operator "${operator}".`);
    }

    return {
      operator: operator as GscPageFilter["operator"],
      expression: readString(filter, "expression"),
    };
  });
}

function ensureUniqueSourceIds(sources: GscSource[]): void {
  const seen = new Set<string>();
  for (const source of sources) {
    if (seen.has(source.id)) {
      throw new Error(`Duplicate GSC source id "${source.id}".`);
    }
    seen.add(source.id);
  }
}

function formatSourceIds(): string {
  const sources = getGscSources();
  return sources.length ? sources.map(({ id }) => id).join(", ") : "none";
}

function readString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || !field.trim()) {
    throw new Error(`GSC source field "${key}" must be a non-empty string.`);
  }

  return field.trim();
}

function readOptionalString(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  if (field === undefined || field === null) {
    return undefined;
  }

  if (typeof field !== "string") {
    throw new Error(`GSC source field "${key}" must be a string when provided.`);
  }

  return field.trim() || undefined;
}

function readBoolean(value: Record<string, unknown>, key: string): boolean {
  const field = value[key];
  if (typeof field !== "boolean") {
    throw new Error(`GSC source field "${key}" must be a boolean.`);
  }

  return field;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
