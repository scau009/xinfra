import { pullImage, stopAndRemoveContainer, runContainer } from './docker.js';
import { getDecryptedEnvVars } from './env.js';
import { pushBuildLog } from './queue.js';

export async function runDeploy(task) {
  const { deployId, projectId, image, targetPort, domain, repoName } = task;
  const containerName = `app-${repoName}-${projectId}`;

  try {
    await log(deployId, 'Pulling image...');
    pullImage(image);
    await log(deployId, 'Image pulled');

    await log(deployId, 'Stopping old container...');
    stopAndRemoveContainer(containerName);

    await log(deployId, 'Loading environment variables...');
    const envVars = await getDecryptedEnvVars(projectId);
    // Platform-injected defaults
    envVars.push({ key: 'PLATFORM_APP_URL', value: `https://${domain}` });
    envVars.push({ key: 'PORT', value: String(targetPort) });

    await log(deployId, 'Starting container...');
    runContainer({ image, containerName, targetPort, domain, envVars });
    await log(deployId, 'Container started');

    await log(deployId, `Deploy complete! https://${domain}`);
    await pushBuildLog(deployId, '__STATUS__:running');
  } catch (err) {
    await log(deployId, `Deploy failed: ${err.message}`);
    await pushBuildLog(deployId, '__STATUS__:failed');
  }
}

async function log(deployId, message) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const line = `[${timestamp}] ${message}`;
  console.log(`[deploy:${deployId}] ${line}`);
  await pushBuildLog(deployId, line);
}
