import { detectDockerfile } from './dockerfile.js';
import { detectNextJs } from './nextjs.js';
import { detectExpress } from './express.js';
import { detectGenericNode } from './generic-node.js';
import { detectStatic } from './static.js';

// Cascade detection: check in priority order
const detectors = [
  detectDockerfile,
  detectNextJs,
  detectExpress,
  detectGenericNode,
  detectStatic,
];

export async function detectFramework(buildDir) {
  for (const detector of detectors) {
    const result = await detector(buildDir);
    if (result) {
      console.log(`Detected framework: ${result.framework}`);
      return result;
    }
  }
  // Final fallback
  return { framework: 'static', targetPort: 80, needsBuild: false };
}
