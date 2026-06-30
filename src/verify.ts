import { getGscSources, validateSource } from "./config/sources";
import { loadConfig } from "./config/env";
import { createGscClient } from "./gsc/gscClient";

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    const gscSources = getGscSources();
    gscSources.forEach(validateSource);
    const client = await createGscClient(config.googleApplicationCredentials);
    const response = await client.sites.list();
    const accessible = new Map(
      (response.data.siteEntry ?? []).flatMap((entry) =>
        entry.siteUrl
          ? [[entry.siteUrl, entry.permissionLevel ?? "unknown"] as const]
          : [],
      ),
    );

    let failed = false;
    for (const source of gscSources) {
      const permission = accessible.get(source.siteUrl);
      if (permission) {
        const filterLabel = source.pageFilters?.length
          ? `; page filters: ${source.pageFilters
              .map(
                ({ operator, expression }) =>
                  `${operator} "${expression}"`,
              )
              .join(", ")}`
          : "";
        console.log(
          `OK ${source.id}: ${source.siteUrl} (${permission}${filterLabel})`,
        );
      } else {
        failed = true;
        console.error(
          `MISSING ${source.id}: ${source.siteUrl} is not accessible to the configured service account.`,
        );
      }
    }

    if (failed) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("GSC source verification failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();
