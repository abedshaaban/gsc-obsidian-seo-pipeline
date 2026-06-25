export type GscDimension = "date" | "query" | "page" | "country" | "device";

export type DatasetName =
  | "queries"
  | "pages"
  | "query-page"
  | "query-page-country"
  | "query-page-device"
  | "date-query-page";

export type RunKind = "daily" | "range" | "yearly";
export type GscSourceType = "main" | "blog" | "legacy";
export type GscFilterOperator =
  | "contains"
  | "equals"
  | "notContains"
  | "notEquals";

export interface GscPageFilter {
  operator: GscFilterOperator;
  expression: string;
}

export interface GscSource {
  id: string;
  label: string;
  siteUrl: string;
  type: GscSourceType;
  enabled: boolean;
  brandQueryRegex?: string;
  pageFilters?: GscPageFilter[];
}

export interface AppConfig {
  obsidianVaultPath: string;
  gscSiteUrl?: string;
  googleApplicationCredentials: string;
  defaultLookbackDays: number;
}

export type StorageConfig = Omit<AppConfig, "googleApplicationCredentials">;

export interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
  kind: RunKind;
  dates: string[];
}

export interface GscDatasetConfig {
  name: DatasetName;
  filename: string;
  dimensions: GscDimension[];
}

export interface GscDataRow {
  sourceId: string;
  sourceLabel: string;
  sourceType: GscSourceType;
  query?: string;
  page?: string;
  date?: string;
  country?: string;
  device?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  startDate: string;
  endDate: string;
}

export type GscDatasetResults = Record<DatasetName, GscDataRow[]>;

export interface ReportSummary {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
}

export interface IdeaEntry {
  sourceId: string;
  sourceLabel: string;
  sourceType: GscSourceType;
  query: string;
  page: string;
  whyItMatters: string;
  suggestedIdea: string;
  priority: "High" | "Medium" | "Low";
  source: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  startDate: string;
  endDate: string;
}

export interface ReportData {
  titleDate: string;
  source: GscSource;
  summary: ReportSummary;
  queryPages: GscDataRow[];
  topQueries: GscDataRow[];
  topNonBrandedQueries: GscDataRow[];
  lowCtrOpportunities: GscDataRow[];
  rankingOpportunities: GscDataRow[];
  blogIdeas: IdeaEntry[];
  quickWins: IdeaEntry[];
}

export interface OutputPaths {
  rawDir: string;
  reportPath: string;
  ideasDir: string;
}
