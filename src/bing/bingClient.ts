interface BingEnvelope<T> { d: T }

export interface BingStat {
  AvgClickPosition?: number;
  AvgImpressionPosition?: number;
  Clicks?: number;
  Date?: string;
  Impressions?: number;
  Query?: string;
}

export class BingWebmasterClient {
  constructor(private readonly apiKey: string) {}

  async get<T>(method: string, parameters: Record<string, string>): Promise<T> {
    const url = new URL(`https://ssl.bing.com/webmaster/api.svc/json/${method}`);
    url.searchParams.set("apikey", this.apiKey);
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (response.ok) {
        const payload = await response.json() as BingEnvelope<T>;
        return payload.d;
      }
      const body = await response.text();
      const throttled = response.status === 429 || /"ErrorCode"\s*:\s*[45]\b/.test(body);
      if (!throttled || attempt === 4) {
        throw new Error(`Bing Webmaster API ${method} failed (${response.status}): ${body.slice(0, 500)}`);
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 10_000 * 2 ** attempt;
      console.warn(`Bing throttled ${method}; retrying in ${Math.ceil(delayMs / 1000)}s (attempt ${attempt + 1}/5).`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`Bing Webmaster API ${method} exhausted retries.`);
  }
}
