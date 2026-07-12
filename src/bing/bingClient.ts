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
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Bing Webmaster API ${method} failed (${response.status}): ${body.slice(0, 500)}`);
    }
    const payload = await response.json() as BingEnvelope<T>;
    return payload.d;
  }
}
