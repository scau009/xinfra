import fs from 'fs/promises';
import path from 'path';

export async function detectGenericNode(buildDir) {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(buildDir, 'package.json'), 'utf-8'));
    const hasStartScript = !!(pkg.scripts && pkg.scripts.start);
    return {
      framework: 'generic-node',
      targetPort: parseInt(process.env.PORT || '3000'),
      needsBuild: hasStartScript,
      hasBuildStep: hasStartScript,
    };
  } catch {
    return null;
  }
}
