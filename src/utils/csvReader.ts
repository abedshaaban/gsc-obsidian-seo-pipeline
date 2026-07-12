import fs from "node:fs";
import { GscDataRow, GscSourceType, SearchEngine } from "../types";

export function readGscCsv(filePath: string): GscDataRow[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const records = parseCsv(fs.readFileSync(filePath, "utf8"));
  if (records.length < 2) {
    return [];
  }
  const headers = records[0];
  return records.slice(1).filter((values) => values.some(Boolean)).map((values) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    return {
      engine: (record.engine || "google") as SearchEngine,
      sourceId: record.sourceId,
      sourceLabel: record.sourceLabel,
      sourceType: record.sourceType as GscSourceType,
      query: record.query || undefined,
      page: record.page || undefined,
      date: record.date || undefined,
      country: record.country || undefined,
      device: record.device || undefined,
      clicks: Number(record.clicks || 0),
      impressions: Number(record.impressions || 0),
      ctr: Number(record.ctr || 0),
      position: Number(record.position || 0),
      startDate: record.startDate,
      endDate: record.endDate,
    };
  });
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}
