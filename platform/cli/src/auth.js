import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.platrc');

export function getApiKey() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    return config.apiKey;
  } catch {
    return null;
  }
}

export function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  fs.chmodSync(CONFIG_PATH, 0o600); // owner read/write only
}
