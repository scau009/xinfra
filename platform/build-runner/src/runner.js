import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectFramework } from './detectors/index.js';
import { pushDeployTask, pushBuildLog } from './queue.js';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const BUILDS_DIR = '/tmp/builds';

function getDockerfileTemplate(framework) {
  const templateMap = {
    nextjs: 'nextjs.dockerfile',
    nuxt: 'nuxt.dockerfile',
    sveltekit: 'sveltekit.dockerfile',
    express: 'express.dockerfile',
    'generic-node': 'generic-node.dockerfile',
    static: 'static.dockerfile',
  };
  return templateMap[framework] || 'generic-node.dockerfile';
}

async function log(deployId, message) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const line = `[${timestamp}] ${message}`;
  console.log(`[deploy:${deployId}] ${line}`);
  await pushBuildLog(deployId, line);
}

export async function runBuild(task) {
  const { deployId, projectId, repoUrl, repoName, sourceType, branch, commitSha, tarPath, domain } = task;
  const buildDir = path.join(BUILDS_DIR, `build-${deployId}`);
  const imageName = `${config.registry.url}/${config.registry.namespace}/${repoName}:${deployId}`;
  const cacheImage = `${config.registry.url}/${config.registry.namespace}/${repoName}:cache`;

  try {
    // 1. Fetch source code
    await log(deployId, 'Fetching source code...');
    if (sourceType === 'cli' && tarPath) {
      await fs.mkdir(buildDir, { recursive: true });
      execSync(`tar -xzf ${tarPath} -C ${buildDir}`, { stdio: 'pipe' });
      await fs.unlink(tarPath).catch(() => {});
    } else if (repoUrl) {
      execSync(`git clone --depth 1 ${repoUrl} ${buildDir}`, {
        stdio: 'pipe',
        timeout: 120_000,
      });
    } else {
      throw new Error('No source available (no repoUrl and no tarPath)');
    }
    await log(deployId, 'Source code fetched');

    // 2. Detect framework
    await log(deployId, 'Detecting framework...');
    const detected = await detectFramework(buildDir);
    await log(deployId, `Detected: ${detected.framework} (port ${detected.targetPort})`);

    // 3. Write Dockerfile (unless user has custom one)
    if (!detected.hasCustomDockerfile) {
      const templatePath = path.join(TEMPLATES_DIR, getDockerfileTemplate(detected.framework));
      const dockerfile = await fs.readFile(templatePath, 'utf-8');
      await fs.writeFile(path.join(buildDir, 'Dockerfile'), dockerfile);
      const ignorePath = path.join(TEMPLATES_DIR, 'dockerignore');
      await fs.copyFile(ignorePath, path.join(buildDir, '.dockerignore'));
    }

    // 4. Docker build (local mode: no push to registry)
    const isLocalMode = !config.registry.url || config.registry.url === 'registry.local';
    await log(deployId, isLocalMode ? 'Building Docker image (local mode)...' : 'Building Docker image...');

    const buildPromise = new Promise((resolve, reject) => {
      const args = isLocalMode
        ? ['build', '-t', imageName, buildDir]
        : ['buildx', 'build', '--cache-from', `type=registry,ref=${cacheImage}`, '--cache-to', `type=registry,ref=${cacheImage},mode=max`, '-t', imageName, '--push', buildDir];

      const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });

      proc.stdout.on('data', async (data) => {
        for (const line of data.toString().trim().split('\n')) {
          if (line) await log(deployId, line);
        }
      });

      proc.stderr.on('data', async (data) => {
        for (const line of data.toString().trim().split('\n')) {
          if (line) await log(deployId, line);
        }
      });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Docker build failed with code ${code}`));
      });
    });

    await buildPromise;
    await log(deployId, isLocalMode ? 'Build complete' : 'Build complete, image pushed');

    // 5. Clean up
    await fs.rm(buildDir, { recursive: true, force: true });
    await log(deployId, 'Cleaned up build directory');

    // 6. Push deploy task
    await pushDeployTask({
      deployId,
      projectId,
      image: imageName,
      targetPort: detected.targetPort,
      domain,
      repoName,
    });
    await log(deployId, 'Deploy task queued');
  } catch (err) {
    await log(deployId, `Build failed: ${err.message}`);
    await pushBuildLog(deployId, '__STATUS__:failed');
    await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
  }
}
