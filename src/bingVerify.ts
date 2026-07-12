import "dotenv/config";
import { BingWebmasterClient } from "./bing/bingClient";
import { getBingSources } from "./config/bingSources";

async function main(): Promise<void> {
  try {
    const key = process.env.BING_WEBMASTER_API_KEY?.trim();
    if (!key) throw new Error("Missing required environment variable: BING_WEBMASTER_API_KEY");
    const sites = await new BingWebmasterClient(key).get<Array<{ Url?: string }>>("GetUserSites", {});
    const accessible = new Set(sites.map(({ Url }) => Url).filter(Boolean));
    let failed = false;
    for (const source of getBingSources()) {
      if (accessible.has(source.siteUrl)) console.log(`OK ${source.id}: ${source.siteUrl}`);
      else { failed = true; console.error(`MISSING ${source.id}: ${source.siteUrl}`); }
    }
    if (failed) process.exitCode = 1;
  } catch (error) {
    console.error("Bing source verification failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
void main();
