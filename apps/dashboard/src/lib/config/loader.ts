import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import { AdwoConfigSchema, type AdwoConfig } from "./schema";
import { DEFAULT_CONFIG } from "./defaults";

export interface LoadedConfig {
  config: AdwoConfig;
  source: "file" | "defaults";
  path?: string;
}

const CONFIG_FILENAME = "adwo.config.yaml";

function findConfigPath(): string | null {
  // Start from cwd and traverse up looking for config file
  let currentDir = process.cwd();

  while (currentDir !== dirname(currentDir)) {
    const configPath = join(currentDir, CONFIG_FILENAME);
    if (existsSync(configPath)) {
      return configPath;
    }
    currentDir = dirname(currentDir);
  }

  // Check root directory as well
  const rootConfigPath = join(currentDir, CONFIG_FILENAME);
  if (existsSync(rootConfigPath)) {
    return rootConfigPath;
  }

  return null;
}

function parseConfigFile(path: string): unknown {
  const content = readFileSync(path, "utf-8");
  return parseYaml(content);
}

export function loadConfig(): LoadedConfig {
  const configPath = findConfigPath();

  if (!configPath) {
    console.warn(
      `[ADWO] No ${CONFIG_FILENAME} found. Using default configuration.`
    );
    console.warn(
      `[ADWO] Create ${CONFIG_FILENAME} in your project root to customize settings.`
    );
    return {
      config: DEFAULT_CONFIG,
      source: "defaults",
    };
  }

  try {
    const rawConfig = parseConfigFile(configPath);
    const result = AdwoConfigSchema.safeParse(rawConfig);

    if (!result.success) {
      console.error(`[ADWO] Invalid configuration in ${configPath}:`);
      result.error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.warn("[ADWO] Falling back to default configuration.");
      return {
        config: DEFAULT_CONFIG,
        source: "defaults",
      };
    }

    console.log(`[ADWO] Configuration loaded from ${configPath}`);
    return {
      config: result.data,
      source: "file",
      path: configPath,
    };
  } catch (error) {
    console.error(`[ADWO] Error reading ${configPath}:`, error);
    console.warn("[ADWO] Falling back to default configuration.");
    return {
      config: DEFAULT_CONFIG,
      source: "defaults",
    };
  }
}

// Cache the config for the lifetime of the process
let cachedConfig: LoadedConfig | null = null;

export function getConfig(): LoadedConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
