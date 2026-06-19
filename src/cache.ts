import fs from 'node:fs';
import path from 'node:path';
import type { Manifest, Skill } from './types.js';

const SKILLDB_DIR = '.skilldb';
const SKILLS_DIR = 'skills';
const MANIFEST_FILE = 'manifest.json';

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function skilldbRoot(cwd?: string): string {
  return path.join(cwd ?? process.cwd(), SKILLDB_DIR);
}

/** Ensure .skilldb/ directory structure exists. */
export function initCache(cwd?: string): string {
  const root = skilldbRoot(cwd);
  ensureDir(path.join(root, SKILLS_DIR));

  const manifestPath = path.join(root, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(manifestPath, JSON.stringify({ installed: {} }, null, 2) + '\n');
  }

  return root;
}

/** Read the local manifest. */
export function readManifest(cwd?: string): Manifest {
  const manifestPath = path.join(skilldbRoot(cwd), MANIFEST_FILE);
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return { installed: {} };
  }
}

/** Write the local manifest. */
export function writeManifest(manifest: Manifest, cwd?: string): void {
  const root = skilldbRoot(cwd);
  ensureDir(root);
  fs.writeFileSync(
    path.join(root, MANIFEST_FILE),
    JSON.stringify(manifest, null, 2) + '\n'
  );
}

/** Save a skill to the local cache. */
export function cacheSkill(skill: Skill, cwd?: string): string {
  const root = skilldbRoot(cwd);
  const skillDir = path.join(root, SKILLS_DIR, skill.pack);
  ensureDir(skillDir);

  const safeName = skill.name.replace(/[/\\:*?"<>|]/g, '-');
  const filePath = path.join(skillDir, `${safeName}.md`);
  fs.writeFileSync(filePath, skill.content ?? `# ${skill.title}\n\n${skill.description}\n`);

  // Update manifest
  const manifest = readManifest(cwd);
  manifest.installed[skill.id] = {
    addedAt: new Date().toISOString(),
    lines: skill.lines,
  };
  writeManifest(manifest, cwd);

  return filePath;
}

/** Check if a skill is already cached. */
export function isCached(skillId: string, cwd?: string): boolean {
  const manifest = readManifest(cwd);
  return skillId in manifest.installed;
}

/** Get the local path for a cached skill. */
export function getCachedPath(skillId: string, cwd?: string): string | null {
  if (!isCached(skillId, cwd)) return null;
  const [pack, file] = skillId.split('/');
  const name = file.replace('.md', '').replace(/[/\\:*?"<>|]/g, '-');
  const filePath = path.join(skilldbRoot(cwd), SKILLS_DIR, pack, `${name}.md`);
  return fs.existsSync(filePath) ? filePath : null;
}

/** List all cached skills. */
export function listCached(cwd?: string): Manifest {
  return readManifest(cwd);
}

/** Ensure .skilldb/ and .skilldbrc are in .gitignore. */
export function updateGitignore(cwd?: string): void {
  const root = cwd ?? process.cwd();
  const gitignorePath = path.join(root, '.gitignore');

  const entries = ['.skilldb/', '.skilldbrc'];
  let content = '';

  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  }

  const toAdd = entries.filter(e => !content.includes(e));
  if (toAdd.length === 0) return;

  const suffix = (content && !content.endsWith('\n') ? '\n' : '') +
    '\n# SkillDB\n' + toAdd.join('\n') + '\n';

  fs.writeFileSync(gitignorePath, content + suffix);
}
