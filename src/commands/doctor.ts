import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { readManifest } from '../cache.js';

const SKILLDB_DIR = '.skilldb';
const SKILLS_DIR = 'skills';
const ACTIVE_DIR = 'active';
const CONFIG_FILE = 'config.json';
const TOKENS_PER_LINE = 10;

interface Config {
  activeProfile?: string;
  budget?: { max: number; unit: string };
}

function readConfig(cwd: string): Config {
  const p = path.join(cwd, SKILLDB_DIR, CONFIG_FILE);
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; }
}

function collectFiles(dir: string): { name: string; lines: number }[] {
  const result: { name: string; lines: number }[] = [];
  if (!fs.existsSync(dir)) return result;

  function walk(d: string): void {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.md')) continue;
      const lines = fs.readFileSync(full, 'utf-8').split('\n').length;
      result.push({ name: path.relative(dir, full), lines });
    }
  }

  walk(dir);
  return result;
}

export async function doctorCommand(): Promise<void> {
  const cwd = process.cwd();
  const manifest = readManifest(cwd);
  const config = readConfig(cwd);
  let issues = 0;

  console.log(pc.bold('SkillDB Doctor\n'));

  // Check .skilldb/ exists
  const skilldbDir = path.join(cwd, SKILLDB_DIR);
  if (!fs.existsSync(skilldbDir)) {
    console.log(pc.red('  [!] .skilldb/ not found. Run "skilldb init" first.'));
    return;
  }
  console.log(pc.green('  [ok] .skilldb/ directory exists'));

  // Check installed skills
  const installedIds = Object.keys(manifest.installed);
  const skillsDir = path.join(cwd, SKILLDB_DIR, SKILLS_DIR);
  const skillFiles = collectFiles(skillsDir);
  console.log(pc.green(`  [ok] ${installedIds.length} skills in manifest, ${skillFiles.length} files on disk`));

  // Check for orphaned manifest entries (in manifest but file missing)
  let orphaned = 0;
  for (const id of installedIds) {
    const [pack, file] = id.split('/');
    const name = file.replace('.md', '').replace(/[/\\:*?"<>|]/g, '-');
    const filePath = path.join(skillsDir, pack, `${name}.md`);
    if (!fs.existsSync(filePath)) {
      orphaned++;
      if (orphaned <= 3) console.log(pc.yellow(`  [!] Missing file for manifest entry: ${id}`));
    }
  }
  if (orphaned > 3) console.log(pc.yellow(`  [!] ...and ${orphaned - 3} more missing files`));
  if (orphaned > 0) issues++;

  // Check active profile
  const activeDir = path.join(cwd, SKILLDB_DIR, ACTIVE_DIR);
  const activeFiles = collectFiles(activeDir);
  if (config.activeProfile) {
    console.log(pc.green(`  [ok] Active profile: ${config.activeProfile} (${activeFiles.length} skills)`));
  } else {
    console.log(pc.yellow('  [!] No active profile. Run "skilldb use <profile>" to set one.'));
    issues++;
  }

  // Check for unused skills (installed but not in active)
  const activeNames = new Set(activeFiles.map(f => f.name));
  const unused = skillFiles.filter(f => !activeNames.has(f.name));
  if (unused.length > 0 && config.activeProfile) {
    console.log(pc.yellow(`  [!] ${unused.length} installed skill(s) not in active profile`));
    issues++;
  }

  // Token/line stats
  const totalLines = skillFiles.reduce((sum, f) => sum + f.lines, 0);
  const activeLines = activeFiles.reduce((sum, f) => sum + f.lines, 0);
  const totalTokens = totalLines * TOKENS_PER_LINE;
  const activeTokens = activeLines * TOKENS_PER_LINE;

  console.log(pc.dim('\n  Summary:'));
  console.log(`    Installed: ${totalLines.toLocaleString()} lines (~${totalTokens.toLocaleString()} tokens)`);
  console.log(`    Active:    ${activeLines.toLocaleString()} lines (~${activeTokens.toLocaleString()} tokens)`);

  // Budget check
  if (config.budget) {
    const budgetValue = config.budget.unit === 'tokens' ? activeTokens : activeLines;
    const pct = Math.round((budgetValue / config.budget.max) * 100);
    const color = pct > 100 ? pc.red : pct > 80 ? pc.yellow : pc.green;
    console.log(`    Budget:    ${color(`${pct}%`)} of ${config.budget.max.toLocaleString()} ${config.budget.unit}`);
    if (pct > 100) issues++;
  }

  // Packs summary
  const packs = new Set(installedIds.map(id => id.split('/')[0]));
  console.log(`    Packs:     ${packs.size} installed`);

  console.log(issues === 0
    ? pc.green('\nNo issues found!')
    : pc.yellow(`\n${issues} issue(s) found. Run suggested commands to fix.`)
  );
}
