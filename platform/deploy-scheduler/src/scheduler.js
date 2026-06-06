import pg from 'pg';
import { pullImage, stopAndRemoveContainer, runContainer } from './docker.js';
import { getDecryptedEnvVars } from './env.js';
import { pushBuildLog } from './queue.js';
import { config } from './config.js';

const pool = new pg.Pool({ connectionString: config.databaseUrl });

function updateDeployStatus(deployId, status) {
  return pool.query('UPDATE deploys SET status=$1, finished_at=NOW() WHERE id=$2', [status, deployId]);
}

const isLocalMode = !config.registry.url || config.registry.url === 'registry.local';

export async function runDeploy(task) {
  const { deployId, projectId, image, targetPort, domain, repoName } = task;
  const containerName = `app-${repoName}-${projectId}`;

  try {
    await updateDeployStatus(deployId, 'deploying');

    if (!isLocalMode) {
      await log(deployId, 'Pulling image...');
      pullImage(image);
      await log(deployId, 'Image pulled');
    }

    await log(deployId, 'Stopping old container...');
    stopAndRemoveContainer(containerName);

    await log(deployId, 'Loading environment variables...');
    const envVars = await getDecryptedEnvVars(projectId);
    envVars.push({ key: 'PLATFORM_APP_URL', value: `https://${domain}` });
    envVars.push({ key: 'PORT', value: String(targetPort) });

    await log(deployId, 'Starting container...');
    const hostPort = isLocalMode ? String(4000 + projectId) : null;
    if (hostPort) await log(deployId, `Local mode: mapping host port ${hostPort}:${targetPort}`);
    runContainer({ image, containerName, targetPort, domain, envVars, hostPort });
    await log(deployId, 'Container started');

    if (hostPort) {
      await log(deployId, `App accessible at http://localhost:${hostPort}`);
    }

    await log(deployId, `Deploy complete! https://${domain}`);
    await updateDeployStatus(deployId, 'running');
    await pushBuildLog(deployId, '__STATUS__:running');
  } catch (err) {
    await log(deployId, `Deploy failed: ${err.message}`);
    await updateDeployStatus(deployId, 'failed');
    await pushBuildLog(deployId, '__STATUS__:failed');
  }
}

async function log(deployId, message) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const line = `[${timestamp}] ${message}`;
  console.log(`[deploy:${deployId}] ${line}`);
  await pushBuildLog(deployId, line);
}
