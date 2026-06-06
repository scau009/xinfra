import { getApiKey } from './auth.js';
import fs from 'fs';

const BASE_URL = process.env.PLAT_API_URL || 'https://api.platform.local';

export async function apiLogin(apiKey) {
  const res = await fetch(`${BASE_URL}/api/cli/login`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return res.json();
}

export async function uploadProject(apiKey, tarPath, repoName) {
  const formData = new FormData();
  const fileBuffer = await fs.promises.readFile(tarPath);
  const blob = new Blob([fileBuffer]);
  formData.append('project', blob, `${repoName}.tar.gz`);
  formData.append('repoName', repoName);

  const res = await fetch(`${BASE_URL}/api/cli/deploy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export async function pollDeploy(token, deployId) {
  const res = await fetch(`${BASE_URL}/api/deploys/${deployId}/logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'log') {
          console.log(data.line);
        } else if (data.type === 'done') {
          return data.status;
        }
      } catch {}
    }
  }
  return 'unknown';
}
