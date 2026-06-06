import fs from 'fs/promises';
import path from 'path';

export async function detectDockerfile(buildDir) {
  const dockerfilePath = path.join(buildDir, 'Dockerfile');
  try {
    await fs.access(dockerfilePath);
    return {
      framework: 'custom',
      targetPort: 3000,
      needsBuild: true,
      hasCustomDockerfile: true,
    };
  } catch {
    return null;
  }
}
