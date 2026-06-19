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

function countDir(dir: string): { files: number; lines: number; packs: Set<string>; categories: Set<string> } {
  const result = { files: 0, lines: 0, packs: new Set<string>(), categories: new Set<string>() };
  if (!fs.existsSync(dir)) return result;

  for (const pack of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!pack.isDirectory()) continue;
    result.packs.add(pack.name);
    // Derive category from pack name suffix
    const cat = pack.name.replace(/-skills$/, '');
    result.categories.add(cat);

    for (const file of fs.readdirSync(path.join(dir, pack.name))) {
      if (!file.endsWith('.md')) continue;
      result.files++;
      result.lines += fs.readFileSync(path.join(dir, pack.name, file), 'utf-8').split('\n').length;
    }
  }
  return result;
}

export async function statsCommand(): Promise<void> {
  const cwd = process.cwd();
  const config = readConfig(cwd);
  const manifest = readManifest(cwd);

  const skillsDir = path.join(cwd, SKILLDB_DIR, SKILLS_DIR);
  const activeDir = path.join(cwd, SKILLDB_DIR, ACTIVE_DIR);

  const installed = countDir(skillsDir);
  const active = countDir(activeDir);

  console.log(pc.bold('SkillDB Stats\n'));

  // Installed
  console.log(pc.cyan('Installed:'));
  console.log(`  Skills:     ${installed.files}`);
  console.log(`  Packs:      ${installed.packs.size}` + (installed.packs.size > 0 ? pc.dim(` (${[...installed.packs].join(', ')})`) : ''));
  console.log(`  Lines:      ${installed.lines.toLocaleString()}`);
  console.log(`  Est tokens: ${(installed.lines * TOKENS_PER_LINE).toLocaleString()}`);

  // Active
  console.log(pc.cyan('\nActive:'));
  if (config.activeProfile) {
    console.log(`  Profile:    ${config.activeProfile}`);
  } else {
    console.log(`  Profile:    ${pc.dim('none')}`);
  }
  console.log(`  Skills:     ${active.files}`);
  console.log(`  Lines:      ${active.lines.toLocaleString()}`);
  console.log(`  Est tokens: ${(active.lines * TOKENS_PER_LINE).toLocaleString()}`);

  // Budget
  if (config.budget) {
    const budgetValue = config.budget.unit === 'tokens'
      ? active.lines * TOKENS_PER_LINE
      : active.lines;
    const pct = Math.round((budgetValue / config.budget.max) * 100);
    const color = pct > 100 ? pc.red : pct > 80 ? pc.yellow : pc.green;
    console.log(pc.cyan('\nBudget:'));
    console.log(`  Limit:      ${config.budget.max.toLocaleString()} ${config.budget.unit}`);
    console.log(`  Usage:      ${color(`${pct}%`)}`);
  }

  // Coverage
  console.log(pc.cyan('\nCoverage:'));
  console.log(`  Categories: ${installed.categories.size} covered`);

  // Gap analysis
  const manifestPacks = new Set(Object.keys(manifest.installed).map(id => id.split('/')[0]));
  const activePacks = active.packs;
  const unusedPacks = [...manifestPacks].filter(p => !activePacks.has(p));
  if (unusedPacks.length > 0) {
    console.log(pc.yellow(`\n  Installed but not active: ${unusedPacks.join(', ')}`));
  }
}
