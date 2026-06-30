# gsc-obsidian-seo-pipeline

Export Google Search Console data into an Obsidian SEO knowledge base with CSV datasets, Markdown reports, and AI-ready content-idea files.

## Prerequisites

- Node.js 20 or newer
- pnpm
- A Google Cloud service account with read access to your Search Console properties
- An Obsidian vault path for generated reports and datasets

## Setup

```bash
pnpm install
cp .env.example .env
cp gsc-sources.example.json gsc-sources.json
```

Fill in `.env`:

```bash
OBSIDIAN_VAULT_PATH=/absolute/path/to/your/obsidian-vault
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/google-service-account.json
DEFAULT_LOOKBACK_DAYS=3
```

The CLI reads source definitions from `gsc-sources.json` in the project root. Set `GSC_SOURCES_CONFIG` if you want to keep that file somewhere else.

## Sources

Configure Search Console properties in `gsc-sources.json`:

```json
{
  "sources": [
    {
      "id": "main-site",
      "label": "Main Site",
      "siteUrl": "sc-domain:example.com",
      "type": "main",
      "enabled": true,
      "brandQueryRegex": "\\b(?:example|example brand)\\b",
      "pageFilters": [
        {
          "operator": "notContains",
          "expression": "https://blog.example.com/"
        }
      ]
    }
  ]
}
```

Use the exact property identifier shown in Search Console:

- Domain properties use `sc-domain:example.com` and include all protocols and subdomains.
- URL-prefix properties use a complete prefix such as `https://blog.example.com/`, including the protocol and trailing slash when that is how the property is registered.

`brandQueryRegex` is applied locally and case-insensitively. Complete raw data is retained, while derived files prefixed with `non-branded-` exclude matching queries.

`type` is a free-form source label written to exported CSVs. The built-in combined analysis gives extra treatment to `main`, `blog`, and `legacy`; other values still work as source labels.

## Commands

Verify Google access without pulling data:

```bash
pnpm run gsc:verify
```

Pull Search Console data:

```bash
pnpm run gsc:pull -- --source main-site
pnpm run gsc:pull -- --all
pnpm run gsc:pull -- --all --last-days 7
pnpm run gsc:pull -- --source main-site --from 2026-03-01 --to 2026-06-20
pnpm run gsc:pull -- --source main-site --date 2026-06-20
```

Without `--source` or `--all`, the CLI uses the first enabled source in `gsc-sources.json`.

Ranges are requested from Search Console one day at a time. Each day gets its own raw files and report, and the complete range also gets an aggregated snapshot.

Analyze already stored data without calling Google:

```bash
pnpm run gsc:analyze -- --source main-site
pnpm run gsc:analyze -- --all
pnpm run gsc:analyze -- --from 2026-06-01 --to 2026-06-20
```

Because analysis is local, it only requires `OBSIDIAN_VAULT_PATH`; Google credentials are not required.

Rebuild yearly and combined datasets from stored daily snapshots:

```bash
pnpm run gsc:rebuild
```

Run `gsc:rebuild` after changing a brand regex to regenerate every stored yearly and combined view without calling Google.

## Datasets

Every export includes source metadata and metrics:

- `queries.csv`: `query`
- `pages.csv`: `page`
- `query-page.csv`: `query`, `page`
- `query-page-country.csv`: `query`, `page`, `country`
- `query-page-device.csv`: `query`, `page`, `device`
- `date-query-page.csv`: `date`, `query`, `page`

Columns are `sourceId`, `sourceLabel`, `sourceType`, optional dimensions, `clicks`, `impressions`, `ctr`, `position`, `startDate`, and `endDate`.

For every dataset containing a query, a `non-branded-*.csv` counterpart is written. Reports include both top queries and top non-branded queries. Low-CTR, ranking, quick-win, and blog-idea sections use non-branded queries.

## Output

```text
SEO/GSC/
  sources/
    <source-id>/
      raw/daily/YYYY-MM-DD/
      raw/ranges/YYYY-MM-DD_to_YYYY-MM-DD/
      raw/yearly/YYYY/
      reports/daily/
      reports/ranges/
      reports/yearly/
      ideas/
  combined/
    raw/yearly/YYYY/
    reports/
    ideas/
```

The combined yearly folder is the pivot-ready cross-source dataset:

```text
SEO/GSC/combined/raw/yearly/2026/date-query-page.csv
SEO/GSC/combined/raw/yearly/2026/non-branded-date-query-page.csv
```

Per-source idea files:

- `blog-ideas.md`
- `quick-wins.md`
- `low-ctr.md`
- `ranking-5-to-20.md`

Combined idea files:

- `global-blog-ideas.md`
- `global-quick-wins.md`
- `migration-opportunities.md`
- `blog-to-main-internal-links.md`
- `cannibalization.md`

Entries are deduplicated with `sourceId + query + page`.

## Development

```bash
pnpm run typecheck
pnpm run build
```
