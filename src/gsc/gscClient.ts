import { google, searchconsole_v1 } from "googleapis";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export async function createGscClient(
  credentialsPath: string,
): Promise<searchconsole_v1.Searchconsole> {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: [GSC_SCOPE],
    });

    await auth.getClient();
    return google.searchconsole({
      version: "v1",
      auth,
    });
  } catch (error) {
    throw new Error(
      `Google authentication failed. Check GOOGLE_APPLICATION_CREDENTIALS and the service account JSON file. ${formatError(error)}`,
    );
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
