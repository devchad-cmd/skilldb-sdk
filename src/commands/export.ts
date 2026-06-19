import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { readManifest, getCachedPath } from '../cache.js';

const SKILLDB_DIR = '.skilldb';
const ACTIVE_DIR = 'active';
const CONFIG_FILE = 'config.json';

interface Config {
  activeProfile?: string;
  budget?: { max: number; unit: string };
}

function readConfig(cwd: string): Config {
  const p = path.join(cwd, SKILLDB_DIR, CONFIG_FILE);
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; }
}

function collectActiveSkills(cwd: string): { pack: string; name: string; path: string }[] {
  const activeDir = path.join(cwd, SKILLDB_DIR, ACTIVE_DIR);
  const result: { pack: string; name: string; path: string }[] = [];
  if (!fs.existsSync(activeDir)) return result;

  for (const pack of fs.readdirSync(activeDir, { withFileTypes: true })) {
    if (!pack.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(activeDir, pack.name))) {
      if (file.endsWith('.md')) {
        result.push({
          pack: pack.name,
          name: file.replace('.md', ''),
          path: path.join(activeDir, pack.name, file),
        });
      }
    }
  }
  return result;
}

function exportClaude(cwd: string): void {
  const skills = collectActiveSkills(cwd);
  if (skills.length === 0) {
    console.error(pc.red('No active skills. Run "skilldb use <profile>" first.'));
    process.exit(1);
  }

  const lines = ['<!-- skilldb:start -->', '## SkillDB Active Skills\n'];
  lines.push('Reference these skills from `.skilldb/active/` when working on tasks:\n');
  for (const s of skills) {
    lines.push(`- \`.skilldb/active/${s.pack}/${s.name}.md\``);
  }
  lines.push('', '<!-- skilldb:end -->');

  const output = lines.join('\n');
  console.log(output);
  console.log(pc.dim('\n--- Copy the above into your CLAUDE.md ---'));
}

function exportCursor(cwd: string): void {
  const skills = collectActiveSkills(cwd);
  if (skills.length === 0) {
    console.error(pc.red('No active skills. Run "skilldb use <profile>" first.'));
    process.exit(1);
  }

  const lines = ['# SkillDB Active Skills', ''];
  lines.push('Reference these skills from `.skilldb/active/` when working on tasks:', '');
  for (const s of skills) {
    lines.push(`@file .skilldb/active/${s.pack}/${s.name}.md`);
  }

  const output = lines.join('\n');
  console.log(output);
  console.log(pc.dim('\n--- Copy the above into your .cursorrules ---'));
}

function exportProfile(cwd: string): void {
  const config = readConfig(cwd);
  const manifest = readManifest(cwd);

  const profile = {
    profile: config.activeProfile || 'custom',
    budget: config.budget || null,
    skills: Object.keys(manifest.installed),
    exportedAt: new Date().toISOString(),
  };

  const filename = '.skilldb-profile.json';
  fs.writeFileSync(path.join(cwd, filename), JSON.stringify(profile, null, 2) + '\n');
  console.log(pc.green(`Exported profile to ${filename}`));
  console.log(pc.dim('Share this file and import with "skilldb use --import .skilldb-profile.json"'));
}

function exportInject(cwd: string, id: string): void {
  if (!id.includes('.md')) id = id + '.md';

  const cachedPath = getCachedPath(id, cwd);
  if (!cachedPath) {
    console.error(pc.red(`Skill "${id}" not found locally. Run "skilldb get ${id}" first.`));
    process.exit(1);
  }

  const content = fs.readFileSync(cachedPath, 'utf-8');
  process.stdout.write(content);
}

export async function exportCommand(format: string, target?: string): Promise<void> {
  const cwd = process.cwd();

  switch (format) {
    case 'claude':
      exportClaude(cwd);
      break;
    case 'cursor':
      exportCursor(cwd);
      break;
    case 'profile':
      exportProfile(cwd);
      break;
    case 'inject':
      if (!target) {
        console.error(pc.red('Usage: skilldb export inject <skill-id>'));
        process.exit(1);
      }
      exportInject(cwd, target);
      break;
    default:
      console.error(pc.red(`Unknown format "${format}". Use: claude, cursor, profile, inject`));
      process.exit(1);
  }
}
