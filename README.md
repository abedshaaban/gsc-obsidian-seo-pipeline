# gsc-obsidian-seo-pipeline

Pull multiple Google Search Console properties into one source-aware Obsidian SEO knowledge base.

## Sources

Configure properties in `src/config/sources.ts`:

```ts
export const gscSources = [
  {
    id: "apelr",
    label: "Apelr Main Domain",
    siteUrl: "sc-domain:apelr.com",
    type: "main",
    enabled: true,
    brandQueryRegex: String.raw`\b(?:apelr|apeolr|apelor|apleor|apler|aperl|aepolar|aperol|aploer|aplore|apealor|apeoler|aplr|apoelr|apeir|apeljr|apeor|aplor|apoler)\b`,
    pageFilters: [
      { operator: "notContains", expression: "https://blog.apelr.com/" },
    ],
  },
  // ...
];
```

`--all` pulls enabled sources. The configured sources are the current
`apelr.com` domain, `blog.apelr.com`, and the legacy `apeolr.com` domain.
Main and blog both use the `sc-domain:apelr.com` Search Console property:
page filters exclude the blog from the main source and select only the blog
for the blog source.

`brandQueryRegex` is applied locally and case-insensitively. Complete raw data
is always retained; derived files prefixed with `non-branded-` exclude matching
queries. Update the expression when another brand spelling appears.

Use the exact property identifier shown in Search Console:

- Domain properties use `sc-domain:apelr.com` and include all protocols and subdomains.
- URL-prefix properties use a complete prefix such as `https://blog.apelr.com/`, including the protocol and trailing slash when that is how the property is registered.

## Environment

```bash
OBSIDIAN_VAULT_PATH=/absolute/path/to/your/vault
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
DEFAULT_LOOKBACK_DAYS=3
```

`GSC_SITE_URL` is still accepted for compatibility with old `.env` files, but source definitions are preferred and control pulls.

The service account must have access to every selected Search Console property.
Verify access without pulling data:

```bash
pnpm run gsc:verify
```

## Commands

```bash
pnpm run gsc:pull -- --source apelr
pnpm run gsc:pull -- --source blog-apelr
pnpm run gsc:pull -- --source old-domain
pnpm run gsc:pull -- --all
pnpm run gsc:pull -- --all --last-days 7
pnpm run gsc:pull -- --source old-domain --from 2026-03-01 --to 2026-06-20
pnpm run gsc:pull -- --source apelr --date 2026-06-20
pnpm run gsc:rebuild
```

Without `--source` or `--all`, the source defaults to `apelr`. Without date options, the command pulls the day `DEFAULT_LOOKBACK_DAYS` ago. `--last-days N` ends on that delayed date.

Ranges are requested from Search Console one day at a time. Each day gets its own raw files and report, and the complete range also gets an aggregated snapshot.

After every pull, the pipeline rebuilds each affected calendar year's
source-level and combined datasets from stored daily snapshots. Re-running a
date replaces that daily snapshot and does not duplicate it in the yearly data.
Run `gsc:rebuild` after changing a brand regex to regenerate every stored
yearly and combined view without calling Google.

Analyze already stored daily data without calling Google:

```bash
pnpm run gsc:analyze -- --source apelr
pnpm run gsc:analyze -- --all
pnpm run gsc:analyze -- --from 2026-06-01 --to 2026-06-20
```

Without date options, analysis uses the latest stored day for each selected source. `--all` includes configured sources that have stored data, including a disabled legacy source.
Because analysis is local, it only requires `OBSIDIAN_VAULT_PATH`; Google credentials are not required.

## Datasets

Every export includes source metadata and metrics:

- `queries.csv`: `query`
- `pages.csv`: `page`
- `query-page.csv`: `query`, `page`
- `query-page-country.csv`: `query`, `page`, `country`
- `query-page-device.csv`: `query`, `page`, `device`
- `date-query-page.csv`: `date`, `query`, `page`

Columns are `sourceId`, `sourceLabel`, `sourceType`, optional dimensions, `clicks`, `impressions`, `ctr`, `position`, `startDate`, and `endDate`.

For every dataset containing a query, a `non-branded-*.csv` counterpart is
written. Reports include both **Top Queries** and **Top Non-Branded Queries**.
Low-CTR, ranking, quick-win, and blog-idea sections use non-branded queries.

## Output

```text
SEO/GSC/
  sources/
    apelr/
      raw/daily/YYYY-MM-DD/
      raw/ranges/YYYY-MM-DD_to_YYYY-MM-DD/
      raw/yearly/YYYY/
      reports/daily/
      reports/ranges/
      reports/yearly/
      ideas/
    blog-apelr/
      raw/
      reports/
      ideas/
    old-domain/
      raw/
      reports/
      ideas/
  combined/
    raw/yearly/YYYY/
    reports/
    ideas/
```

The combined yearly folder is the pivot-ready cross-source dataset. For
example:

```text
SEO/GSC/combined/raw/yearly/2026/date-query-page.csv
SEO/GSC/combined/raw/yearly/2026/non-branded-date-query-page.csv
```

Use `date-query-page.csv` for time-series pivots and the non-branded version
for discovery queries that do not contain an Apelr/Apeolr spelling.

Per-source idea files:

- `blog-ideas.md`
- `quick-wins.md`
- `low-ctr.md`
- `ranking-5-to-20.md`

Entries are deduplicated with `sourceId + query + page`.

Combined idea files:

- `global-blog-ideas.md`
- `global-quick-wins.md`
- `migration-opportunities.md`
- `blog-to-main-internal-links.md`
- `cannibalization.md`

The combined report compares main, blog, and legacy data. It calls out shared main/blog queries, internal-link opportunities, legacy migration candidates, low-CTR pages, ranking quick wins, and exact-query cannibalization signals.

## Examples

The `examples/` directory includes source configuration, source-aware CSV samples, a combined report, and a migration-opportunities file.

## Development

```bash
pnpm run typecheck
pnpm run build
```
