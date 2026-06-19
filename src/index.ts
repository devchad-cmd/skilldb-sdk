export { SkillDBClient } from './client.js';
export type {
  Skill,
  PackInfo,
  CategoryInfo,
  SkillsResponse,
  SearchOptions,
  ClientConfig,
  Manifest,
  ApiKeyScope,
  ApiKeyInfo,
} from './types.js';
export { resolveApiKey, resolveBaseUrl, saveApiKey } from './config.js';
export { initCache, cacheSkill, isCached, getCachedPath, listCached } from './cache.js';

import type { ClientConfig } from './types.js';
import { SkillDBClient } from './client.js';

/** Create a SkillDB client. Auto-loads API key from env/config. */
export function createClient(config?: ClientConfig): SkillDBClient {
  return new SkillDBClient(config);
}
