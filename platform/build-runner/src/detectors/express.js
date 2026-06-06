import fs from 'fs/promises';
import path from 'path';

export async function detectExpress(buildDir) {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(buildDir, 'package.json'), 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.express) {
      return { framework: 'express', targetPort: 3000, needsBuild: false };
    }
  } catch {}
  return null;
}
