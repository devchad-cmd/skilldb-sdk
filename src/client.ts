import type { ClientConfig, Skill, SkillsResponse, SearchOptions } from './types.js';
import { resolveApiKey, resolveBaseUrl } from './config.js';

/** Input for creating/updating a private skill via /my-skills. */
export interface CreateSkillInput {
  name: string;
  content: string;
  title?: string;
  description?: string;
  pack?: string;
  tags?: string[];
  visibility?: 'private' | 'shared';
}

/** A private-skill record as returned by /my-skills. */
export interface PrivateSkillSummary {
  id: string;
  name: string;
  title: string;
  pack: string;
  visibility: string;
  lines: number;
  tags?: string[];
}

export class SkillDBClient {
  private apiKey?: string;
  private baseUrl: string;

  constructor(config?: ClientConfig) {
    this.apiKey = config?.apiKey ?? resolveApiKey();
    this.baseUrl = config?.baseUrl ?? resolveBaseUrl();
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      h['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  /** Make an authenticated request to any endpoint (used by MCP tools for private skills). */
  public async rawRequest(endpoint: string, init?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...this.headers(), ...(init?.headers || {}) };
    return fetch(url, { ...init, headers });
  }


  private async typedRequest<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), { headers: this.headers() });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const apiError = body && typeof body === 'object' ? (body as Record<string, string>).error : null;
      const status = res.status;
      const statusText = res.statusText || 'Unknown';

      // Build a descriptive error with actionable guidance
      let msg: string;
      if (apiError) {
        msg = apiError;
      } else if (status === 500) {
        msg = `SkillDB API internal error (HTTP 500). The service may be experiencing issues. Check status at https://skilldb.dev/api/v1/status`;
      } else if (status === 503) {
        msg = `SkillDB API unavailable (HTTP 503). The skills index may not be loaded. Check status at https://skilldb.dev/api/v1/status`;
      } else if (status === 401) {
        msg = `Invalid or expired API key (HTTP 401). Get a free key at https://skilldb.dev/api-access`;
      } else if (status === 429) {
        msg = `Rate limit exceeded (HTTP 429). Authenticate with an API key for higher limits: https://skilldb.dev/api-access`;
      } else if (status === 404) {
        msg = `Resource not found (HTTP 404). The requested skill or endpoint does not exist.`;
      } else {
        msg = `SkillDB API error: HTTP ${status} ${statusText}. Check https://skilldb.dev/api/v1/status for service health.`;
      }
      throw new Error(msg);
    }

    return res.json() as Promise<T>;
  }

  /** Search skills by keyword. */
  async search(query: string, options?: Omit<SearchOptions, 'search'>): Promise<SkillsResponse> {
    return this.typedRequest<SkillsResponse>('/skills', {
      search: query,
      category: options?.category ?? '',
      pack: options?.pack ?? '',
      sort: options?.sort ?? '',
      limit: String(options?.limit ?? 20),
      offset: String(options?.offset ?? 0),
      include_content: options?.includeContent ? 'true' : '',
    });
  }

  /** List skills with optional filters and sorting. */
  async list(options?: SearchOptions): Promise<SkillsResponse> {
    return this.typedRequest<SkillsResponse>('/skills', {
      category: options?.category ?? '',
      pack: options?.pack ?? '',
      search: options?.search ?? '',
      sort: options?.sort ?? '',
      limit: String(options?.limit ?? 50),
      offset: String(options?.offset ?? 0),
      include_content: options?.includeContent ? 'true' : '',
    });
  }

  /** Get a single skill by ID (e.g. "software-skills/code-review.md"). */
  async get(id: string): Promise<Skill> {
    const encoded = encodeURIComponent(id);
    const res = await this.typedRequest<Skill | { skill: Skill }>(`/skills/${encoded}`, {
      include_content: 'true',
    });
    // Handle both direct and wrapped responses
    return 'skill' in res ? res.skill : res;
  }

  /** Batch retrieve multiple skills by IDs (max 50). */
  async batch(ids: string[]): Promise<SkillsResponse> {
    return this.typedRequest<SkillsResponse>('/skills', {
      ids: ids.slice(0, 50).join(','),
      include_content: 'true',
    });
  }

  /** Get search autocomplete suggestions. */
  async suggest(query: string): Promise<{ suggestions: Array<{ title: string; pack: string; category: string; id: string }> }> {
    return this.typedRequest('/skills/suggest', { q: query });
  }

  /** Validate that the configured API key works. */
  async validate(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/keys/usage`;
      const res = await fetch(url, { headers: this.headers() });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Private skills (write) ──────────────────────────────────────────
  // Endpoints are relative to baseUrl (…/api/v1), so the path is "/my-skills".

  private async writeRequest<T>(endpoint: string, init: RequestInit): Promise<T> {
    const res = await this.rawRequest(endpoint, init);
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) {
      const err = (data as { error?: string }).error;
      throw new Error(err || `HTTP ${res.status} ${res.statusText || ''}`.trim());
    }
    return data as T;
  }

  /** List the caller's private skills (own + shared). Requires a write-scoped key. */
  async listMySkills(): Promise<{ skills: PrivateSkillSummary[]; shared: PrivateSkillSummary[]; total: number; sharedTotal: number }> {
    return this.writeRequest('/my-skills', { method: 'GET' });
  }

  /** Create a private skill. Requires the Studio plan + a write-scoped key. */
  async createSkill(input: CreateSkillInput): Promise<{ skill: PrivateSkillSummary }> {
    return this.writeRequest('/my-skills', { method: 'POST', body: JSON.stringify(input) });
  }

  /** Update an existing private skill. Requires the Studio plan + a write-scoped key. */
  async updateSkill(id: string, input: Partial<CreateSkillInput>): Promise<{ skill: PrivateSkillSummary }> {
    return this.writeRequest(`/my-skills/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) });
  }
}
