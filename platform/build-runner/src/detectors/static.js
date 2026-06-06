import fs from 'fs/promises';
import path from 'path';

export async function detectStatic(buildDir) {
  const candidates = ['index.html', 'dist/index.html', 'public/index.html', 'build/index.html'];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(buildDir, candidate));
      return {
        framework: 'static',
        targetPort: 80,
        needsBuild: false,
        staticRoot: path.dirname(candidate),
      };
    } catch {}
  }
  // No features detected, serve as static site anyway
  return { framework: 'static', targetPort: 80, needsBuild: false };
}
