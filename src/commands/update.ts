import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { SkillDBClient } from '../client.js';
import { readManifest, cacheSkill } from '../cache.js';

const SKILLDB_DIR = '.skilldb';
const SKILLS_DIR = 'skills';

export async function updateCommand(pack?: string): Promise<void> {
  const cwd = process.cwd();
  const client = new SkillDBClient();
  const manifest = readManifest(cwd);
  const installedIds = Object.keys(manifest.installed);

  if (installedIds.length === 0) {
    console.log(pc.yellow('No skills installed. Use "skilldb add <pack>" first.'));
    return;
  }

  // Filter by pack if specified
  const targetIds = pack
    ? installedIds.filter(id => id.startsWith(pack + '/'))
    : installedIds;

  if (targetIds.length === 0) {
    console.error(pc.red(`No installed skills found for pack "${pack}".`));
    process.exit(1);
  }

  console.log(pc.bold(`Updating ${targetIds.length} skill(s)...\n`));

  // Group by pack for efficient fetching
  const packGroups = new Map<string, string[]>();
  for (const id of targetIds) {
    const p = id.split('/')[0];
    if (!packGroups.has(p)) packGroups.set(p, []);
    packGroups.get(p)!.push(id);
  }

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const [packName, ids] of packGroups) {
    try {
      const res = await client.list({ pack: packName, limit: 500, includeContent: true });
      const remoteMap = new Map(res.skills.map(s => [s.id, s]));

      for (const id of ids) {
        const remote = remoteMap.get(id);
        if (!remote) {
          console.log(pc.dim(`  skip  ${id} (not found on remote)`));
          continue;
        }

        // Compare content
        const localPath = path.join(cwd, SKILLDB_DIR, SKILLS_DIR, packName,
          id.split('/')[1].replace('.md', '').replace(/[/\\:*?"<>|]/g, '-') + '.md');

        let localContent = '';
        try { localContent = fs.readFileSync(localPath, 'utf-8'); } catch { /* missing */ }

        if (remote.content && remote.content !== localContent) {
          const oldLines = localContent.split('\n').length;
          const newLines = remote.content.split('\n').length;
          const diff = newLines - oldLines;
          const diffStr = diff > 0 ? `+${diff}` : `${diff}`;

          cacheSkill(remote, cwd);
          updated++;
          console.log(
            pc.green(`  update  ${id}`) +
            pc.dim(` (${diffStr} lines)`)
          );
        } else {
          unchanged++;
        }
      }
    } catch (err) {
      failed += ids.length;
      console.log(pc.red(`  fail  ${packName}: ${(err as Error).message}`));
    }
  }

  console.log(
    `\n${pc.green(`${updated} updated`)}` +
    pc.dim(`, ${unchanged} unchanged`) +
    (failed > 0 ? pc.red(`, ${failed} failed`) : '')
  );
}
