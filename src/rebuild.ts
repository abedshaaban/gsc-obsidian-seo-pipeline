import { getGscSources, validateSource } from "./config/sources";
import { loadStorageConfig } from "./config/env";
import { rebuildYearlyOutputs } from "./outputPipeline";
import { listStoredDailyDates } from "./storage/yearlyDatasets";

async function main(): Promise<void> {
  try {
    const config = loadStorageConfig();
    const gscSources = getGscSources();
    gscSources.forEach(validateSource);
    const years = [
      ...new Set(
        gscSources.flatMap((source) =>
          listStoredDailyDates(config.obsidianVaultPath, source.id).map(
            (date) => date.slice(0, 4),
          ),
        ),
      ),
    ].sort();

    if (years.length === 0) {
      console.warn("No source-aware daily snapshots found to rebuild.");
      return;
    }

    await rebuildYearlyOutputs(config.obsidianVaultPath, years);
    console.log(`Rebuilt yearly outputs for ${years.join(", ")}.`);
  } catch (error) {
    console.error("GSC rebuild failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();
