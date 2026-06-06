import path from 'path';
import fs from 'fs';
import { getApiKey } from '../auth.js';
import { createTarGz } from '../pack.js';
import { uploadProject, pollDeploy } from '../api.js';
import { apiLogin } from '../api.js';

export async function deploy() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Not logged in. Run "plat login" first.');
    process.exit(1);
  }

  // Exchange API Key for token
  const auth = await apiLogin(apiKey);

  const projectDir = process.cwd();
  const repoName = process.argv[3] || path.basename(projectDir);

  console.log(`Deploying "${repoName}"...`);

  // Pack project
  const { tarPath } = createTarGz(projectDir);

  // Upload
  console.log('Uploading project...');
  const result = await uploadProject(apiKey, tarPath, repoName);

  // Clean up tar
  fs.unlinkSync(tarPath);

  console.log(`Build queued: deploy #${result.deployId}`);

  // Stream logs
  const status = await pollDeploy(auth.token, result.deployId);

  if (status === 'running') {
    console.log(`\n✅ Deploy successful!`);
  } else {
    console.log(`\n❌ Deploy failed`);
    process.exit(1);
  }
}
