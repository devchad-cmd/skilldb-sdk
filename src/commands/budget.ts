import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

const SKILLDB_DIR = '.skilldb';
const CONFIG_FILE = 'config.json';
const ACTIVE_DIR = 'active';
const TOKENS_PER_LINE = 10; // rough estimate

interface Config {
  activeProfile?: string;
  budget?: { max: number; unit: string };
  [key: string]: unknown;
}

function readConfig(cwd: string): Config {
  const p = path.join(cwd, SKILLDB_DIR, CONFIG_FILE);
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; }
}

function writeConfig(cwd: string, config: Config): void {
  const dir = path.join(cwd, SKILLDB_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, CONFIG_FILE), JSON.stringify(config, null, 2) + '\n');
}

function countActiveSkills(cwd: string): { files: string[]; totalLines: number; totalTokens: number } {
  const activeDir = path.join(cwd, SKILLDB_DIR, ACTIVE_DIR);
  const files: string[] = [];
  let totalLines = 0;

  if (!fs.existsSync(activeDir)) return { files, totalLines, totalTokens: 0 };

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.md')) continue;
      const content = fs.readFileSync(full, 'utf-8');
      const lines = content.split('\n').length;
      files.push(path.relative(path.join(cwd, SKILLDB_DIR), full));
      totalLines += lines;
    }
  }

  walk(activeDir);
  return { files, totalLines, totalTokens: totalLines * TOKENS_PER_LINE };
}

function parseBudget(value: string): { max: number; unit: string } {
  const lower = value.toLowerCase();
  if (lower.endsWith('k')) {
    return { max: parseInt(lower) * 1000, unit: 'tokens' };
  }
  const num = parseInt(value);
  if (num > 10000) return { max: num, unit: 'tokens' };
  return { max: num, unit: 'lines' };
}

export async function budgetCommand(action?: string, value?: string): Promise<void> {
  const cwd = process.cwd();
  const config = readConfig(cwd);
  const usage = countActiveSkills(cwd);

  if (action === 'set' && value) {
    const budget = parseBudget(value);
    config.budget = budget;
    writeConfig(cwd, config);
    console.log(pc.green(`Budget set to ${budget.max.toLocaleString()} ${budget.unit}`));
    return;
  }

  if (action === 'optimize') {
    if (!config.budget) {
      console.error(pc.red('No budget set. Run "skilldb budget set <value>" first.'));
      process.exit(1);
    }

    const budgetValue = config.budget.unit === 'tokens' ? usage.totalTokens : usage.totalLines;
    if (budgetValue <= config.budget.max) {
      console.log(pc.green('Already within budget. No changes needed.'));
      return;
    }

    // Remove skills from active/ until under budget, starting from largest
    const activeDir = path.join(cwd, SKILLDB_DIR, ACTIVE_DIR);
    const skillFiles: { path: string; lines: number }[] = [];

    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.md')) continue;
        const lines = fs.readFileSync(full, 'utf-8').split('\n').length;
        skillFiles.push({ path: full, lines });
      }
    }
    walk(activeDir);
    skillFiles.sort((a, b) => b.lines - a.lines);

    let current = config.budget.unit === 'tokens' ? usage.totalTokens : usage.totalLines;
    let removed = 0;
    for (const sf of skillFiles) {
      if (current <= config.budget.max) break;
      fs.unlinkSync(sf.path);
      current -= config.budget.unit === 'tokens' ? sf.lines * TOKENS_PER_LINE : sf.lines;
      removed++;
      console.log(pc.yellow(`  removed ${path.basename(sf.path)}`) + pc.dim(` (${sf.lines} lines)`));
    }

    console.log(pc.green(`\nOptimized: removed ${removed} skill(s) to fit budget.`));
    return;
  }

  // Default: show budget status
  console.log(pc.bold('Budget Status\n'));
  console.log(`  ${pc.cyan('Active skills:')}  ${usage.files.length}`);
  console.log(`  ${pc.cyan('Total lines:')}    ${usage.totalLines.toLocaleString()}`);
  console.log(`  ${pc.cyan('Est. tokens:')}    ${usage.totalTokens.toLocaleString()}`);

  if (config.budget) {
    const budgetValue = config.budget.unit === 'tokens' ? usage.totalTokens : usage.totalLines;
    const pct = Math.round((budgetValue / config.budget.max) * 100);
    const color = pct > 100 ? pc.red : pct > 80 ? pc.yellow : pc.green;
    console.log(`  ${pc.cyan('Budget:')}         ${config.budget.max.toLocaleString()} ${config.budget.unit}`);
    console.log(`  ${pc.cyan('Usage:')}          ${color(`${pct}%`)}`);
  } else {
    console.log(pc.dim('\n  No budget set. Use "skilldb budget set <value>" to set one.'));
  }
}
