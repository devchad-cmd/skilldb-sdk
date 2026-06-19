import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import readline from 'node:readline';
import { readManifest, writeManifest } from '../cache.js';

const SKILLDB_DIR = '.skilldb';
const SKILLS_DIR = 'skills';
const ACTIVE_DIR = 'active';
const SLIM_DIR = 'slim';

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

interface PurgeStats {
  skillsRemoved: number;
  packsRemoved: number;
  slimRemoved: number;
  bytesFreed: number;
  activeKept: number;
}

function getDirectorySize(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let size = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) size += getDirectorySize(full);
    else size += fs.statSync(full).size;
  }
  return size;
}

function collectAllSkills(dir: string): string[] {
  const skills: string[] = [];
  if (!fs.existsSync(dir)) return skills;
  for (const pack of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!pack.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(dir, pack.name))) {
      if (file.endsWith('.md')) skills.push(`${pack.name}/${file}`);
    }
  }
  return skills;
}

function collectActivePacks(cwd: string): Set<string> {
  const activeDir = path.join(cwd, SKILLDB_DIR, ACTIVE_DIR);
  const packs = new Set<string>();
  if (!fs.existsSync(activeDir)) return packs;
  for (const entry of fs.readdirSync(activeDir, { withFileTypes: true })) {
    if (entry.isDirectory()) packs.add(entry.name);
  }
  return packs;
}

export async function purgeCommand(options?: {
  all?: boolean;
  inactive?: boolean;
  slim?: boolean;
  dryRun?: boolean;
  force?: boolean;
}): Promise<void> {
  const cwd = process.cwd();
  const skillsDir = path.join(cwd, SKILLDB_DIR, SKILLS_DIR);
  const activeDir = path.join(cwd, SKILLDB_DIR, ACTIVE_DIR);
  const slimDir = path.join(cwd, SKILLDB_DIR, SLIM_DIR);

  if (!fs.existsSync(path.join(cwd, SKILLDB_DIR))) {
    console.log(pc.red('No .skilldb/ directory found. Run "skilldb init" first.'));
    process.exit(1);
  }

  const allSkills = collectAllSkills(skillsDir);
  const activePacks = collectActivePacks(cwd);
  const activeSkills = new Set<string>();

  // Collect active skill IDs
  if (fs.existsSync(activeDir)) {
    for (const pack of fs.readdirSync(activeDir, { withFileTypes: true })) {
      if (!pack.isDirectory()) continue;
      for (const file of fs.readdirSync(path.join(activeDir, pack.name))) {
        if (file.endsWith('.md')) activeSkills.add(`${pack.name}/${file}`);
      }
    }
  }

  const inactiveSkills = allSkills.filter(s => !activeSkills.has(s));
  const slimSkills = collectAllSkills(slimDir);

  const totalSize = getDirectorySize(path.join(cwd, SKILLDB_DIR));
  const skillsSize = getDirectorySize(skillsDir);
  const slimSize = getDirectorySize(slimDir);

  console.log(pc.bold('\nSkillDB Purge\n'));
  console.log(`  Total skills cached:  ${pc.cyan(String(allSkills.length))}`);
  console.log(`  Active skills:        ${pc.green(String(activeSkills.size))}`);
  console.log(`  Inactive skills:      ${pc.yellow(String(inactiveSkills.length))}`);
  console.log(`  Slim summaries:       ${pc.dim(String(slimSkills.length))}`);
  console.log(`  Total disk usage:     ${pc.cyan((totalSize / 1024).toFixed(0) + ' KB')}`);
  console.log();

  if (allSkills.length === 0 && slimSkills.length === 0) {
    console.log(pc.dim('Nothing to purge.'));
    return;
  }

  const stats: PurgeStats = { skillsRemoved: 0, packsRemoved: 0, slimRemoved: 0, bytesFreed: 0, activeKept: activeSkills.size };

  // Determine what to purge
  let toPurge: string[] = [];
  let purgeSlim = options?.slim || options?.all || false;

  if (options?.all) {
    toPurge = [...allSkills];
    purgeSlim = true;
    console.log(pc.red(`Will remove ALL ${allSkills.length} cached skills + ${slimSkills.length} slim summaries`));
  } else if (options?.inactive) {
    toPurge = inactiveSkills;
    console.log(pc.yellow(`Will remove ${inactiveSkills.length} inactive skills (keeping ${activeSkills.size} active)`));
  } else {
    // Default: purge inactive + slim
    toPurge = inactiveSkills;
    purgeSlim = true;
    console.log(pc.yellow(`Will remove ${inactiveSkills.length} inactive skills + ${slimSkills.length} slim summaries`));
    console.log(pc.green(`  Keeping ${activeSkills.size} active skills`));
  }

  if (toPurge.length === 0 && !purgeSlim) {
    console.log(pc.dim('\nNothing to purge — all skills are active.'));
    return;
  }

  // Confirm
  if (!options?.force && !options?.dryRun) {
    const answer = await prompt(`\n  Continue? (y/N) `);
    if (answer.toLowerCase() !== 'y') {
      console.log(pc.dim('Cancelled.'));
      return;
    }
  }

  if (options?.dryRun) {
    console.log(pc.dim('\n  (Dry run — no files will be deleted)\n'));
    for (const skill of toPurge.slice(0, 20)) {
      console.log(pc.dim(`  would remove: ${skill}`));
    }
    if (toPurge.length > 20) console.log(pc.dim(`  ... and ${toPurge.length - 20} more`));
    return;
  }

  // Purge cached skills
  const manifest = readManifest(cwd);
  for (const skillId of toPurge) {
    const [pack, file] = skillId.split('/');
    const filePath = path.join(skillsDir, pack, file);
    if (fs.existsSync(filePath)) {
      stats.bytesFreed += fs.statSync(filePath).size;
      fs.unlinkSync(filePath);
      stats.skillsRemoved++;
    }
    // Remove from manifest
    if (manifest.installed[skillId]) {
      delete manifest.installed[skillId];
    }
    // Clean empty pack dirs
    const packDir = path.join(skillsDir, pack);
    if (fs.existsSync(packDir) && fs.readdirSync(packDir).length === 0) {
      fs.rmdirSync(packDir);
      stats.packsRemoved++;
    }
  }

  // Purge slim summaries
  if (purgeSlim && fs.existsSync(slimDir)) {
    for (const pack of fs.readdirSync(slimDir, { withFileTypes: true })) {
      if (!pack.isDirectory()) continue;
      const packPath = path.join(slimDir, pack.name);
      for (const file of fs.readdirSync(packPath)) {
        const filePath = path.join(packPath, file);
        stats.bytesFreed += fs.statSync(filePath).size;
        fs.unlinkSync(filePath);
        stats.slimRemoved++;
      }
      if (fs.readdirSync(packPath).length === 0) fs.rmdirSync(packPath);
    }
  }

  // If purging all, also clear active
  if (options?.all && fs.existsSync(activeDir)) {
    for (const pack of fs.readdirSync(activeDir, { withFileTypes: true })) {
      if (!pack.isDirectory()) continue;
      const packPath = path.join(activeDir, pack.name);
      for (const file of fs.readdirSync(packPath)) {
        fs.unlinkSync(path.join(packPath, file));
      }
      fs.rmdirSync(packPath);
    }
    stats.activeKept = 0;
  }

  writeManifest(manifest, cwd);

  console.log(pc.green(`\n  ✓ Purge complete`));
  console.log(`    Skills removed:  ${stats.skillsRemoved}`);
  console.log(`    Slim removed:    ${stats.slimRemoved}`);
  console.log(`    Packs cleaned:   ${stats.packsRemoved}`);
  console.log(`    Space freed:     ${(stats.bytesFreed / 1024).toFixed(0)} KB`);
  console.log(`    Active kept:     ${stats.activeKept}`);
}
