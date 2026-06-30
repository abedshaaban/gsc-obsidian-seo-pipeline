import dotenv from "dotenv";
import { AppConfig, StorageConfig } from "../types";
import { assertExistingDirectory, assertExistingFile } from "../utils/fileUtils";

dotenv.config();

export function loadConfig(): AppConfig {
  const storageConfig = loadStorageConfig();
  const googleApplicationCredentials = readRequiredEnv("GOOGLE_APPLICATION_CREDENTIALS");
  assertExistingFile(googleApplicationCredentials, "GOOGLE_APPLICATION_CREDENTIALS");

  return {
    ...storageConfig,
    googleApplicationCredentials,
  };
}

export function loadStorageConfig(): StorageConfig {
  const obsidianVaultPath = readRequiredEnv("OBSIDIAN_VAULT_PATH");
  const defaultLookbackDays = parseLookbackDays(process.env.DEFAULT_LOOKBACK_DAYS ?? "3");

  assertExistingDirectory(obsidianVaultPath, "OBSIDIAN_VAULT_PATH");

  return {
    obsidianVaultPath,
    defaultLookbackDays,
  };
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseLookbackDays(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("DEFAULT_LOOKBACK_DAYS must be a positive integer. Example: DEFAULT_LOOKBACK_DAYS=3");
  }

  return parsed;
}
