/**
 * ADWO 2.0 Configuration Types
 * Based on adwo.config.yaml schema
 */

export interface ProjectConfig {
  name: string;
}

export interface AdwoConfig {
  version: string;
  project: ProjectConfig;
}

export interface LoadedConfig {
  config: AdwoConfig;
  source: "file" | "defaults";
  path?: string;
}
