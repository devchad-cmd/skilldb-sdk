import pc from 'picocolors';
import { saveApiKey } from '../config.js';
import { SkillDBClient } from '../client.js';
import readline from 'node:readline';

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function loginCommand(): Promise<void> {
  console.log(pc.bold('SkillDB Login'));
  console.log('Get your API key at https://skilldb.dev/api-access\n');

  const apiKey = await prompt('API key: ');

  if (!apiKey) {
    console.log(pc.red('No API key provided.'));
    process.exit(1);
  }

  if (!apiKey.startsWith('sk_')) {
    console.log(pc.yellow('Warning: API key should start with "sk_". Saving anyway.'));
  }

  // Validate the key
  process.stdout.write('Validating... ');
  const client = new SkillDBClient({ apiKey });
  const valid = await client.validate();

  if (valid) {
    const savedTo = saveApiKey(apiKey);
    console.log(pc.green('valid!'));
    console.log(`Saved to ${pc.dim(savedTo)}`);
  } else {
    console.log(pc.yellow('could not validate (saved anyway)'));
    const savedTo = saveApiKey(apiKey);
    console.log(`Saved to ${pc.dim(savedTo)}`);
  }
}
