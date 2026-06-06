import { execSync } from 'child_process';
import path from 'path';
import os from 'os';

export function createTarGz(projectDir) {
  const name = path.basename(projectDir);
  const tarPath = path.join(os.tmpdir(), `${name}-${Date.now()}.tar.gz`);

  execSync(
    `tar -czf ${tarPath} --exclude='node_modules' --exclude='.git' --exclude='.next' --exclude='.nuxt' --exclude='dist' --exclude='build' --exclude='.env' --exclude='*.log' -C ${path.dirname(projectDir)} ${name}`,
    { stdio: 'pipe' }
  );

  return { tarPath, repoName: name };
}
