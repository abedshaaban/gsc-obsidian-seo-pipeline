import fs from "node:fs";
import path from "node:path";

export function ensureDirectory(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function assertExistingDirectory(dirPath: string, label: string): void {
  if (!dirPath) {
    throw new Error(`${label} is required.`);
  }

  if (!fs.existsSync(dirPath)) {
    throw new Error(`${label} does not exist: ${dirPath}`);
  }

  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(`${label} must be a directory: ${dirPath}`);
  }
}

export function assertExistingFile(filePath: string, label: string): void {
  if (!filePath) {
    throw new Error(`${label} is required.`);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} does not exist: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`${label} must be a file: ${filePath}`);
  }
}

export function buildOutputPaths(
  vaultPath: string,
  sourceId: string,
  kind: "daily" | "range" | "yearly",
  label: string,
  engine: "GSC" | "Bing" = "GSC",
) {
  const gscRoot = path.join(vaultPath, "SEO", engine, "sources", sourceId);
  const rawDir =
    kind === "daily"
      ? path.join(gscRoot, "raw", "daily", label)
      : kind === "range"
        ? path.join(gscRoot, "raw", "ranges", label)
        : path.join(gscRoot, "raw", "yearly", label);
  const reportPath =
    kind === "daily"
      ? path.join(gscRoot, "reports", "daily", `${label}.md`)
      : kind === "range"
        ? path.join(gscRoot, "reports", "ranges", `${label}.md`)
        : path.join(gscRoot, "reports", "yearly", `${label}.md`);

  return {
    rawDir,
    reportPath,
    ideasDir: path.join(gscRoot, "ideas"),
  };
}

export function buildCombinedPaths(vaultPath: string, engine: "GSC" | "Bing" = "GSC"): { reportsDir: string; ideasDir: string } {
  const root = path.join(vaultPath, "SEO", engine, "combined");
  return {
    reportsDir: path.join(root, "reports"),
    ideasDir: path.join(root, "ideas"),
  };
}

export function buildCombinedYearlyRawDir(vaultPath: string, year: string, engine: "GSC" | "Bing" = "GSC"): string {
  return path.join(vaultPath, "SEO", engine, "combined", "raw", "yearly", year);
}
