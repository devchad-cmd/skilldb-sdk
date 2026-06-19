import pc from 'picocolors';
import { SkillDBClient } from '../client.js';
import { initCache, cacheSkill, isCached, getCachedPath } from '../cache.js';

export async function getCommand(id: string): Promise<void> {
  const client = new SkillDBClient();

  // Normalize: accept "pack/skill" without .md
  if (!id.includes('.md')) {
    id = id + '.md';
  }

  // Check if already cached
  if (isCached(id)) {
    const cachedPath = getCachedPath(id);
    console.log(pc.dim(`Already cached: ${cachedPath}`));
    return;
  }

  console.log(pc.dim(`Fetching ${id}...`));
  initCache();

  try {
    const skill = await client.get(id);

    if (!skill.content) {
      console.log(pc.yellow('Skill fetched (metadata only — no content without API key).'));
      console.log(pc.yellow('Run "skilldb login" with a Pro key to download full content.'));
    }

    const filePath = cacheSkill(skill);
    console.log(pc.green(`✓ Saved ${skill.title}`) + pc.dim(` → ${filePath}`));
    console.log(pc.dim(`  ${skill.lines} lines | ${skill.packLabel} | ${skill.category}`));
  } catch (err) {
    console.error(pc.red(`Error: ${(err as Error).message}`));
    process.exit(1);
  }
}
