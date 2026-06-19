import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const RC_FILE = '.skilldbrc';

export const DEFAULT_BASE_URL = 'https://skilldb.dev/api/v1';

interface RcConfig {
  apiKey?: string;
}

function readJson(filePath: string): RcConfig | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Resolve API key from (in priority order):
 * 1. SKILLDB_API_KEY env var
 * 2. .skilldbrc in project root (cwd)
 * 3. ~/.skilldbrc in home dir
 */
export function resolveApiKey(): string | undefined {
  if (process.env.SKILLDB_API_KEY) {
    return process.env.SKILLDB_API_KEY;
  }

  const projectRc = path.join(process.cwd(), RC_FILE);
  const projectConfig = readJson(projectRc);
  if (projectConfig?.apiKey) return projectConfig.apiKey;

  const homeRc = path.join(os.homedir(), RC_FILE);
  const homeConfig = readJson(homeRc);
  if (homeConfig?.apiKey) return homeConfig.apiKey;

  return undefined;
}

/**
 * Resolve base URL from env or default.
 */
export function resolveBaseUrl(): string {
  return process.env.SKILLDB_API_URL || DEFAULT_BASE_URL;
}

/**
 * Save API key to ~/.skilldbrc (user-wide) or project .skilldbrc.
 */
export function saveApiKey(apiKey: string, global = true): string {
  const target = global
    ? path.join(os.homedir(), RC_FILE)
    : path.join(process.cwd(), RC_FILE);

  const existing = readJson(target) || {};
  fs.writeFileSync(target, JSON.stringify({ ...existing, apiKey }, null, 2) + '\n', 'utf-8');
  return target;
}
