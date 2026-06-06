import readline from 'readline';
import { saveConfig, getApiKey } from '../auth.js';
import { apiLogin } from '../api.js';

export async function login() {
  const existingKey = getApiKey();
  if (existingKey) {
    console.log('Already logged in. To re-login, delete ~/.platrc first.');
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  console.log('Get your API Key from: https://platform.local/settings/api-key');
  const apiKey = await ask('Paste your API Key: ');
  rl.close();

  if (!apiKey.trim()) {
    console.error('API Key is required');
    process.exit(1);
  }

  const result = await apiLogin(apiKey.trim());
  saveConfig({ apiKey: apiKey.trim(), username: result.username });
  console.log(`Logged in as ${result.username}`);
}
