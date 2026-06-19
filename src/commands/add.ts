import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { SkillDBClient } from '../client.js';
import { initCache, cacheSkill, isCached } from '../cache.js';

function getConfig(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), '.skilldb', 'config.json'), 'utf-8'));
  } catch { return {}; }
}

function getSkillsDir(): string | null {
  const config = getConfig();
  const dir = config.skillsDir as string | undefined;
  if (dir && fs.existsSync(path.dirname(dir))) return dir;

  // Auto-detect
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, '.claude'))) return path.join(cwd, '.claude', 'skills', 'skilldb');
  if (fs.existsSync(path.join(cwd, '.cursor'))) return path.join(cwd, '.cursor', 'rules', 'skilldb');
  if (fs.existsSync(path.join(cwd, '.codex'))) return path.join(cwd, '.codex', 'skills', 'skilldb');
  return null;
}

export async function addCommand(packName: string, options?: { target?: string }): Promise<void> {
  const client = new SkillDBClient();
  const target = options?.target || getConfig().installMode as string || 'cache';

  console.log(pc.bold(`Adding pack: ${packName}`));

  // Determine where to install
  const useSkillsDir = target === 'skills-dir' || target === 'hybrid';
  const skillsDir = useSkillsDir ? getSkillsDir() : null;

  if (useSkillsDir && !skillsDir) {
    console.error(pc.red('No IDE skills directory found. Run "skilldb init" first.'));
    process.exit(1);
  }

  if (useSkillsDir && skillsDir) {
    console.log(`Target: ${pc.cyan(skillsDir)} ${pc.dim('(IDE auto-loads these)')}`);
  } else {
    console.log(`Target: ${pc.dim('.skilldb/skills/ (cache)')}`);
  }

  initCache();

  try {
    const res = await client.list({ pack: packName, limit: 500, includeContent: true });

    if (res.skills.length === 0) {
      console.error(pc.red(`Pack "${packName}" not found or empty.`));
      process.exit(1);
    }

    let added = 0;
    let skipped = 0;

    for (const skill of res.skills) {
      // Always cache
      if (!isCached(skill.id)) {
        cacheSkill(skill);
      }

      // Also install to IDE skills directory if requested
      if (useSkillsDir && skillsDir && skill.content) {
        const packDir = path.join(skillsDir, skill.pack);
        fs.mkdirSync(packDir, { recursive: true });
        const skillFile = path.join(packDir, skill.name + '.md');

        if (fs.existsSync(skillFile)) {
          skipped++;
          console.log(pc.dim(`  skip  ${skill.id} (already installed)`));
        } else {
          fs.writeFileSync(skillFile, skill.content);
          added++;
          console.log(pc.green(`  add   ${skill.id}`) + pc.dim(` → ${path.relative(process.cwd(), skillFile)}`));
        }
      } else if (!useSkillsDir) {
        if (isCached(skill.id)) {
          skipped++;
          console.log(pc.dim(`  skip  ${skill.id} (already cached)`));
        } else {
          added++;
          console.log(pc.green(`  add   ${skill.id}`));
        }
      }
    }

    console.log(
      `\n${pc.green(`${added} skill${added === 1 ? '' : 's'} added`)}` +
      (skipped > 0 ? pc.dim(`, ${skipped} skipped`) : '')
    );

    if (useSkillsDir && skillsDir) {
      console.log(pc.dim(`\nSkills installed to ${path.relative(process.cwd(), skillsDir)}`));
      console.log(pc.dim('Your IDE will auto-load them — no CLAUDE.md changes needed.'));
    }

    if (res.skills.some(s => !s.content)) {
      console.log(pc.yellow('\nNote: Some skills were cached without content (metadata only).'));
      console.log(pc.yellow('Run "skilldb login" with a Pro key to download full content.'));
    }
  } catch (err) {
    console.error(pc.red(`Error: ${(err as Error).message}`));
    process.exit(1);
  }
}
