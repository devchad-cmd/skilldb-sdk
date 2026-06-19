import pc from 'picocolors';
import { SkillDBClient } from '../client.js';

export async function infoCommand(id: string): Promise<void> {
  const client = new SkillDBClient();

  // Normalize: accept "pack/skill" without .md
  if (!id.includes('.md')) {
    id = id + '.md';
  }

  try {
    const skill = await client.get(id);

    console.log(pc.bold(skill.title));
    console.log(pc.dim('─'.repeat(50)));
    console.log(`${pc.cyan('ID:')}          ${skill.id}`);
    console.log(`${pc.cyan('Pack:')}        ${skill.packLabel} (${skill.pack})`);
    console.log(`${pc.cyan('Category:')}    ${skill.category}`);
    console.log(`${pc.cyan('Lines:')}       ${skill.lines}`);
    console.log(`${pc.cyan('Description:')} ${skill.description}`);

    if (skill.content) {
      console.log(pc.dim('\n─── Preview ───────────────────────────────────'));
      const preview = skill.content.split('\n').slice(0, 20).join('\n');
      console.log(preview);
      if (skill.content.split('\n').length > 20) {
        console.log(pc.dim(`\n... ${skill.lines - 20} more lines`));
      }
    }
  } catch (err) {
    console.error(pc.red(`Error: ${(err as Error).message}`));
    process.exit(1);
  }
}
