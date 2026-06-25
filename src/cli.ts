import { gscSources, getSource, validateSource } from "./config/sources";
import { loadConfig } from "./config/env";
import {
  aggregateDailyDatasets,
  fetchAllSearchAnalytics,
} from "./gsc/fetchSearchAnalytics";
import { createGscClient } from "./gsc/gscClient";
import { rebuildYearlyOutputs, writeOutputs } from "./outputPipeline";
import { GscDatasetResults, GscSource } from "./types";
import { parseCliArgs } from "./utils/dateUtils";

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    const args = parseCliArgs(process.argv.slice(2), config.defaultLookbackDays);
    const sources = selectSources(args.sourceId, args.all);
    sources.forEach(validateSource);

    const client = await createGscClient(config.googleApplicationCredentials);
    for (const source of sources) {
      await pullSource(source, args.dateRange, config.obsidianVaultPath, client);
    }
    await rebuildYearlyOutputs(
      config.obsidianVaultPath,
      [...new Set(args.dateRange.dates.map((date) => date.slice(0, 4)))],
    );

    console.log(`GSC pull complete for ${sources.length} source(s).`);
  } catch (error) {
    console.error("GSC pull failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function selectSources(sourceId: string | undefined, all: boolean): GscSource[] {
  if (sourceId) {
    return [getSource(sourceId)];
  }
  if (all) {
    const enabled = gscSources.filter((source) => source.enabled);
    if (enabled.length === 0) {
      throw new Error("No enabled GSC sources are configured.");
    }
    return enabled;
  }
  return [getSource("apelr")];
}

async function pullSource(
  source: GscSource,
  dateRange: ReturnType<typeof parseCliArgs>["dateRange"],
  vaultPath: string,
  client: Awaited<ReturnType<typeof createGscClient>>,
): Promise<void> {
  console.log(
    `Pulling ${source.label} (${source.siteUrl}) for ${dateRange.startDate} to ${dateRange.endDate}`,
  );

  const dailyResults: GscDatasetResults[] = [];
  for (const date of dateRange.dates) {
    console.log(`  Fetching ${date}`);
    const datasets = await fetchAllSearchAnalytics(
      client,
      source.siteUrl,
      date,
      date,
      source,
    );
    dailyResults.push(datasets);
    await writeOutputs(source, datasets, vaultPath, "daily", date);
  }

  if (dateRange.kind === "range") {
    const aggregated = aggregateDailyDatasets(
      dailyResults,
      dateRange.startDate,
      dateRange.endDate,
    );
    await writeOutputs(source, aggregated, vaultPath, "range", dateRange.label);
  }
}

void main();
