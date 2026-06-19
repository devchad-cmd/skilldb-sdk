import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { SkillDBClient } from '../client.js';
import { resolveApiKey } from '../config.js';

interface PushOptions {
  pack?: string;
  name?: string;
  title?: string;
  description?: string;
  tags?: string;
  update?: boolean;
}

/**
 * `skilldb push <file.md>` — create (or update) a private skill from a local
 * Markdown file. Requires the Studio plan + an API key with 'write' scope.
 */
export async function pushCommand(file: string, options: PushOptions): Promise<void> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.log(pc.red('No API key found.') + ' Run ' + pc.cyan('skilldb login') + ' first (needs a write-scoped key).');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.log(pc.red(`File not found: ${filePath}`));
    process.exit(1);
  }

  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.log(pc.red(`Could not read file: ${(e as Error).message}`));
    process.exit(1);
  }
  if (!content.trim()) {
    console.log(pc.red('File is empty — nothing to push.'));
    process.exit(1);
  }

  const baseName = path.basename(filePath).replace(/\.(md|markdown|txt)$/i, '');
  const name = (options.name || baseName).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const pack = options.pack || 'personal';
  const tags = options.tags ? options.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined;
  // Title precedence: explicit flag > first Markdown H1 > filename.
  const h1 = content.match(/^#\s+(.+)$/m);
  const title = options.title || (h1 ? h1[1].trim() : baseName);

  const id = `${pack.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}/${name}.md`;
  const client = new SkillDBClient({ apiKey });
  const input = { name, title, description: options.description, content, pack, tags };

  process.stdout.write(`${options.update ? 'Updating' : 'Pushing'} ${pc.cyan(id)} ... `);
  try {
    const { skill } = options.update
      ? await client.updateSkill(id, input)
      : await client.createSkill(input);
    console.log(pc.green(options.update ? 'updated' : 'created'));
    console.log(`  ${pc.bold(skill.title)}  ${pc.dim(skill.id)}  ·  ${skill.lines} lines  ·  ${skill.visibility}`);
    console.log(pc.dim('Find it with ') + pc.cyan('skilldb my-skills') + pc.dim(' or in your authenticated search results.'));
  } catch (e) {
    console.log(pc.red('failed'));
    const msg = (e as Error).message;
    console.log('  ' + pc.red(msg));
    if (/Studio/i.test(msg)) console.log('  ' + pc.dim('Private skills require the Studio plan: https://skilldb.dev/pricing'));
    else if (/write scope/i.test(msg)) console.log('  ' + pc.dim('Create a key with write scope at https://skilldb.dev/account#api-keys'));
    else if (/not found/i.test(msg) && options.update) console.log('  ' + pc.dim('No skill with that name/pack — drop --update to create it.'));
    process.exit(1);
  }
}
