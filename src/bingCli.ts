import { BingWebmasterClient } from "./bing/bingClient";
import { fetchBingAnalytics } from "./bing/fetchBingAnalytics";
import { getBingSource, getBingSources } from "./config/bingSources";
import { loadStorageConfig } from "./config/env";
import { rebuildEngineYearlyOutputs, writeOutputs } from "./outputPipeline";
import { parseCliArgs } from "./utils/dateUtils";

async function main(): Promise<void> {
  try {
    const config = loadStorageConfig();
    const apiKey = process.env.BING_WEBMASTER_API_KEY?.trim();
    if (!apiKey) throw new Error("Missing required environment variable: BING_WEBMASTER_API_KEY");
    const args = parseCliArgs(process.argv.slice(2), config.defaultLookbackDays);
    const all = getBingSources();
    const sources = args.sourceId ? [getBingSource(args.sourceId)] : args.all ? all.filter(({ enabled }) => enabled) : [all.find(({ enabled }) => enabled) ?? all[0]];
    if (!sources[0]) throw new Error("No Bing sources are configured.");
    const client = new BingWebmasterClient(apiKey);
    for (const source of sources) {
      console.log(`Pulling Bing data for ${source.label} (${args.dateRange.label})`);
      const result = await fetchBingAnalytics(client, source, args.dateRange);
      for (const date of args.dateRange.dates) await writeOutputs(source, result.daily.get(date)!, config.obsidianVaultPath, "daily", date);
      if (args.dateRange.kind === "range") await writeOutputs(source, result.range, config.obsidianVaultPath, "range", args.dateRange.label);
    }
    await rebuildEngineYearlyOutputs(config.obsidianVaultPath, [...new Set(args.dateRange.dates.map((date) => date.slice(0, 4)))], all);
    console.log(`Bing pull complete for ${sources.length} source(s).`);
  } catch (error) {
    console.error("Bing pull failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
void main();
