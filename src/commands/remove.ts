import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { readManifest, writeManifest } from '../cache.js';

const SKILLDB_DIR = '.skilldb';
const SKILLS_DIR = 'skills';
const ACTIVE_DIR = 'active';

function collectActiveSkills(cwd: string): Set<string> {
  const activeDir = path.join(cwd, SKILLDB_DIR, ACTIVE_DIR);
  const result = new Set<string>();
  if (!fs.existsSync(activeDir)) return result;

  for (const pack of fs.readdirSync(activeDir, { withFileTypes: true })) {
    if (!pack.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(activeDir, pack.name))) {
      if (file.endsWith('.md')) {
        result.add(`${pack.name}/${file}`);
      }
    }
  }
  return result;
}

function removeSkillFile(cwd: string, id: string): boolean {
  const [pack, file] = id.split('/');
  const name = file.replace('.md', '').replace(/[/\\:*?"<>|]/g, '-');
  const filePath = path.join(cwd, SKILLDB_DIR, SKILLS_DIR, pack, `${name}.md`);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    // Clean up empty pack directory
    const packDir = path.join(cwd, SKILLDB_DIR, SKILLS_DIR, pack);
    if (fs.existsSync(packDir) && fs.readdirSync(packDir).length === 0) {
      fs.rmdirSync(packDir);
    }
    return true;
  }
  return false;
}

export async function removeCommand(target: string, options: { unused?: boolean }): Promise<void> {
  const cwd = process.cwd();
  const manifest = readManifest(cwd);

  if (options.unused) {
    const activeSkills = collectActiveSkills(cwd);
    const installedIds = Object.keys(manifest.installed);
    let removed = 0;

    for (const id of installedIds) {
      const [pack, file] = id.split('/');
      const name = file.replace('.md', '').replace(/[/\\:*?"<>|]/g, '-') + '.md';
      const key = `${pack}/${name}`;

      if (!activeSkills.has(key)) {
        removeSkillFile(cwd, id);
        delete manifest.installed[id];
        removed++;
        console.log(pc.yellow(`  remove  ${id}`));
      }
    }

    writeManifest(manifest, cwd);
    console.log(removed > 0
      ? pc.green(`\n${removed} unused skill(s) removed.`)
      : pc.dim('No unused skills found.')
    );
    return;
  }

  // Normalize target
  if (!target.includes('/')) {
    // Remove entire pack
    const packIds = Object.keys(manifest.installed).filter(id => id.startsWith(target + '/'));

    if (packIds.length === 0) {
      console.error(pc.red(`No installed skills found for "${target}".`));
      process.exit(1);
    }

    const activeSkills = collectActiveSkills(cwd);
    let activeWarning = false;

    for (const id of packIds) {
      const [pack, file] = id.split('/');
      const name = file.replace('.md', '').replace(/[/\\:*?"<>|]/g, '-') + '.md';
      if (activeSkills.has(`${pack}/${name}`)) activeWarning = true;

      removeSkillFile(cwd, id);
      delete manifest.installed[id];
      console.log(pc.yellow(`  remove  ${id}`));
    }

    writeManifest(manifest, cwd);
    console.log(pc.green(`\n${packIds.length} skill(s) from "${target}" removed.`));
    if (activeWarning) {
      console.log(pc.yellow('Warning: Some removed skills were in your active profile.'));
      console.log(pc.yellow('Run "skilldb use <profile>" to refresh.'));
    }
    return;
  }

  // Remove single skill
  let id = target;
  if (!id.includes('.md')) id = id + '.md';

  if (!(id in manifest.installed)) {
    console.error(pc.red(`Skill "${id}" is not installed.`));
    process.exit(1);
  }

  const activeSkills = collectActiveSkills(cwd);
  const [pack, file] = id.split('/');
  const name = file.replace('.md', '').replace(/[/\\:*?"<>|]/g, '-') + '.md';

  removeSkillFile(cwd, id);
  delete manifest.installed[id];
  writeManifest(manifest, cwd);

  console.log(pc.green(`Removed ${id}`));
  if (activeSkills.has(`${pack}/${name}`)) {
    console.log(pc.yellow('Warning: This skill was in your active profile. Run "skilldb use <profile>" to refresh.'));
  }
}
