import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { SkillDBClient } from '../client.js';
import { readManifest } from '../cache.js';

const SKILLDB_DIR = '.skilldb';
const SKILLS_DIR = 'skills';

function diffLines(local: string, remote: string): { added: number; removed: number; changed: boolean } {
  const localLines = local.split('\n');
  const remoteLines = remote.split('\n');
  let added = 0;
  let removed = 0;

  const localSet = new Set(localLines);
  const remoteSet = new Set(remoteLines);

  for (const line of remoteLines) {
    if (!localSet.has(line)) added++;
  }
  for (const line of localLines) {
    if (!remoteSet.has(line)) removed++;
  }

  return { added, removed, changed: added > 0 || removed > 0 };
}

function showDiff(id: string, local: string, remote: string): void {
  const result = diffLines(local, remote);

  if (!result.changed) {
    console.log(pc.dim(`  ${id}: up to date`));
    return;
  }

  console.log(pc.bold(`  ${id}:`));
  if (result.added > 0) console.log(pc.green(`    +${result.added} lines added`));
  if (result.removed > 0) console.log(pc.red(`    -${result.removed} lines removed`));

  // Show first few changed lines
  const localLines = local.split('\n');
  const remoteLines = remote.split('\n');
  const localSet = new Set(localLines);
  const remoteSet = new Set(remoteLines);
  let shown = 0;

  for (const line of remoteLines) {
    if (!localSet.has(line) && line.trim()) {
      console.log(pc.green(`    + ${line.slice(0, 80)}`));
      if (++shown >= 3) break;
    }
  }
  shown = 0;
  for (const line of localLines) {
    if (!remoteSet.has(line) && line.trim()) {
      console.log(pc.red(`    - ${line.slice(0, 80)}`));
      if (++shown >= 3) break;
    }
  }
}

export async function diffCommand(target?: string): Promise<void> {
  const cwd = process.cwd();
  const client = new SkillDBClient();
  const manifest = readManifest(cwd);
  const installedIds = Object.keys(manifest.installed);

  if (installedIds.length === 0) {
    console.log(pc.yellow('No skills installed.'));
    return;
  }

  // Single skill diff
  if (target) {
    let id = target;
    if (!id.includes('.md')) id = id + '.md';

    const [pack, file] = id.split('/');
    const name = file.replace('.md', '').replace(/[/\\:*?"<>|]/g, '-');
    const localPath = path.join(cwd, SKILLDB_DIR, SKILLS_DIR, pack, `${name}.md`);

    if (!fs.existsSync(localPath)) {
      console.error(pc.red(`Skill "${id}" not found locally.`));
      process.exit(1);
    }

    console.log(pc.bold('Comparing with remote...\n'));

    try {
      const remote = await client.get(id);
      const localContent = fs.readFileSync(localPath, 'utf-8');

      if (!remote.content) {
        console.log(pc.yellow('Remote content not available (API key required).'));
        return;
      }

      showDiff(id, localContent, remote.content);
    } catch (err) {
      console.error(pc.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
    return;
  }

  // Diff all installed
  console.log(pc.bold(`Comparing ${installedIds.length} skill(s) with remote...\n`));

  const packGroups = new Map<string, string[]>();
  for (const id of installedIds) {
    const p = id.split('/')[0];
    if (!packGroups.has(p)) packGroups.set(p, []);
    packGroups.get(p)!.push(id);
  }

  let changed = 0;
  let upToDate = 0;

  for (const [packName, ids] of packGroups) {
    try {
      const res = await client.list({ pack: packName, limit: 500, includeContent: true });
      const remoteMap = new Map(res.skills.map(s => [s.id, s]));

      for (const id of ids) {
        const remote = remoteMap.get(id);
        if (!remote?.content) continue;

        const [pack, file] = id.split('/');
        const name = file.replace('.md', '').replace(/[/\\:*?"<>|]/g, '-');
        const localPath = path.join(cwd, SKILLDB_DIR, SKILLS_DIR, pack, `${name}.md`);

        let localContent = '';
        try { localContent = fs.readFileSync(localPath, 'utf-8'); } catch { continue; }

        const result = diffLines(localContent, remote.content);
        if (result.changed) {
          showDiff(id, localContent, remote.content);
          changed++;
        } else {
          upToDate++;
        }
      }
    } catch (err) {
      console.log(pc.red(`  Error fetching ${packName}: ${(err as Error).message}`));
    }
  }

  console.log(`\n${pc.green(`${upToDate} up to date`)}` +
    (changed > 0 ? pc.yellow(`, ${changed} changed`) : ''));
  if (changed > 0) {
    console.log(pc.dim('Run "skilldb update" to pull latest versions.'));
  }
}
