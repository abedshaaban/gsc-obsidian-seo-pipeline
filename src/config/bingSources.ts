import fs from "node:fs";
import path from "node:path";
import { GscSource } from "../types";

const DEFAULT_PATH = "bing-sources.json";
let cached: GscSource[] | undefined;

export function getBingSources(): GscSource[] {
  cached ??= load();
  return cached;
}

export function getBingSource(id: string): GscSource {
  const source = getBingSources().find((item) => item.id === id);
  if (!source) throw new Error(`Unknown Bing source "${id}".`);
  return source;
}

function load(): GscSource[] {
  const filePath = path.resolve(process.cwd(), process.env.BING_SOURCES_CONFIG ?? DEFAULT_PATH);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Bing sources config at ${filePath}. Copy bing-sources.example.json to bing-sources.json first.`);
  }
  const value: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const rows = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null && Array.isArray((value as { sources?: unknown }).sources)
      ? (value as { sources: unknown[] }).sources
      : undefined;
  if (!rows) throw new Error(`Invalid Bing sources config at ${filePath}.`);
  const sources = rows.map((row): GscSource => {
    if (typeof row !== "object" || row === null) throw new Error("Each Bing source must be an object.");
    const item = row as Record<string, unknown>;
    const required = (key: string): string => {
      if (typeof item[key] !== "string" || !(item[key] as string).trim()) throw new Error(`Bing source field "${key}" is required.`);
      return (item[key] as string).trim();
    };
    const siteUrl = required("siteUrl");
    if (!/^https?:\/\//.test(siteUrl)) throw new Error(`Bing siteUrl must start with http:// or https://: ${siteUrl}`);
    return {
      engine: "bing",
      id: required("id"),
      label: required("label"),
      siteUrl,
      type: required("type"),
      enabled: item.enabled === undefined ? true : item.enabled === true,
      brandQueryRegex: typeof item.brandQueryRegex === "string" ? item.brandQueryRegex : undefined,
    };
  });
  if (new Set(sources.map(({ id }) => id)).size !== sources.length) throw new Error("Bing source IDs must be unique.");
  return sources;
}
