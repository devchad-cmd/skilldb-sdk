/** A single skill from the SkillDB catalog. */
export interface Skill {
  id: string;
  name: string;
  title: string;
  description: string;
  file: string;
  pack: string;
  packLabel: string;
  category: string;
  lines: number;
  content?: string;
}

/** Metadata about a skill pack. */
export interface PackInfo {
  slug: string;
  label: string;
  category: string;
  count: number;
}

/** Category summary. */
export interface CategoryInfo {
  name: string;
  packCount: number;
  skillCount: number;
}

/** Paginated API response. */
export interface SkillsResponse {
  skills: Skill[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  meta: {
    categories: string[];
    totalPacks: number;
  };
}

/** Options for searching/listing skills. */
export interface SearchOptions {
  category?: string;
  pack?: string;
  search?: string;
  sort?: 'name' | '-name' | 'lines' | '-lines' | 'pack' | '-pack' | 'category' | '-category';
  limit?: number;
  offset?: number;
  includeContent?: boolean;
}

/** SDK client configuration. */
export interface ClientConfig {
  apiKey?: string;
  baseUrl?: string;
}

/** API key scopes for permission control. */
export type ApiKeyScope = 'read' | 'write' | 'community';

/** API key information returned from key management endpoints. */
export interface ApiKeyInfo {
  id: string;
  key: string;
  name: string;
  plan: string;
  scopes: ApiKeyScope[];
  monthlyLimit: number;
  rateLimit: number;
}

/** Local manifest tracking installed skills. */
export interface Manifest {
  installed: Record<string, { addedAt: string; lines: number }>;
}
