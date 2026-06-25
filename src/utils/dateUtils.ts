import { DateRange } from "../types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ParsedCliArgs {
  sourceId?: string;
  all: boolean;
  dateRange: DateRange;
}

export function parseCliArgs(args: string[], defaultLookbackDays: number): ParsedCliArgs {
  const options = parseOptions(args);
  const sourceId = readSingle(options, "source");
  const all = options.has("all");

  if (sourceId && all) {
    throw new Error("Use either --source or --all, not both.");
  }

  return {
    sourceId,
    all,
    dateRange: buildDateRange(options, defaultLookbackDays),
  };
}

export function parseAnalysisArgs(
  args: string[],
  defaultLookbackDays: number,
): Omit<ParsedCliArgs, "dateRange"> & { dateRange?: DateRange } {
  const options = parseOptions(args);
  const sourceId = readSingle(options, "source");
  const all = options.has("all");
  if (sourceId && all) {
    throw new Error("Use either --source or --all, not both.");
  }

  const hasDateOption = ["date", "from", "to", "last-days"].some((key) => options.has(key));
  return {
    sourceId,
    all,
    dateRange: hasDateOption ? buildDateRange(options, defaultLookbackDays) : undefined,
  };
}

function buildDateRange(options: Map<string, string | true>, defaultLookbackDays: number): DateRange {
  const date = readSingle(options, "date");
  const from = readSingle(options, "from");
  const to = readSingle(options, "to");
  const lastDaysValue = readSingle(options, "last-days");
  const selectedModes = Number(Boolean(date)) + Number(Boolean(from || to)) + Number(Boolean(lastDaysValue));

  if (selectedModes > 1) {
    throw new Error("Use only one of --date, --from/--to, or --last-days.");
  }
  if ((from && !to) || (!from && to)) {
    throw new Error("Date ranges require both --from YYYY-MM-DD and --to YYYY-MM-DD.");
  }
  if (date) {
    return makeRange(parseIsoDate(date, "--date"), parseIsoDate(date, "--date"));
  }
  if (from && to) {
    const startDate = parseIsoDate(from, "--from");
    const endDate = parseIsoDate(to, "--to");
    if (startDate > endDate) {
      throw new Error("--from must be before or equal to --to.");
    }
    return makeRange(startDate, endDate);
  }
  if (lastDaysValue) {
    const lastDays = parsePositiveInteger(lastDaysValue, "--last-days");
    const endDate = daysAgo(defaultLookbackDays);
    return makeRange(addDays(endDate, -(lastDays - 1)), endDate);
  }

  const defaultDate = daysAgo(defaultLookbackDays);
  return makeRange(defaultDate, defaultDate);
}

function makeRange(startDate: string, endDate: string): DateRange {
  const dates = enumerateDates(startDate, endDate);
  return {
    startDate,
    endDate,
    label: startDate === endDate ? startDate : `${startDate}_to_${endDate}`,
    kind: startDate === endDate ? "daily" : "range",
    dates,
  };
}

function parseOptions(args: string[]): Map<string, string | true> {
  const parsed = new Map<string, string | true>();
  const flags = new Set(["all"]);
  const values = new Set(["source", "date", "from", "to", "last-days"]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    const key = arg.slice(2);
    if (flags.has(key)) {
      parsed.set(key, true);
      continue;
    }
    if (!values.has(key)) {
      throw new Error(`Unknown option: ${arg}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${arg} requires a value.`);
    }
    parsed.set(key, value);
    index += 1;
  }

  return parsed;
}

function readSingle(options: Map<string, string | true>, key: string): string | undefined {
  const value = options.get(key);
  return typeof value === "string" ? value : undefined;
}

export function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let current = startDate; current <= endDate; current = addDays(current, 1)) {
    dates.push(current);
  }
  return dates;
}

export function parseIsoDate(value: string, label: string): string {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format. Received: ${value}`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${label} is not a valid calendar date: ${value}`);
  }
  return value;
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function addDays(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
