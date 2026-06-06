import fs from 'fs/promises';
import path from 'path';

export async function detectNextJs(buildDir) {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(buildDir, 'package.json'), 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.next) {
      return { framework: 'nextjs', targetPort: 3000, needsBuild: true };
    }
  } catch {}
  return null;
}
