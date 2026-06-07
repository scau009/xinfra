import { execSync } from 'child_process';

export function pullImage(image) {
  execSync(`docker pull ${image}`, { stdio: 'pipe', timeout: 300_000 });
}

export function stopAndRemoveContainer(containerName) {
  try {
    console.log(`[docker] stopping container: ${containerName}`);
    execSync(`docker stop --time 5 ${containerName}`, { stdio: 'pipe', timeout: 15000 });
    console.log(`[docker] stopped: ${containerName}`);
  } catch (e) {
    console.log(`[docker] stop ${containerName}: ${e.message || 'ignored'}`);
  }
  try {
    console.log(`[docker] removing container: ${containerName}`);
    execSync(`docker rm ${containerName}`, { stdio: 'pipe', timeout: 5000 });
    console.log(`[docker] removed: ${containerName}`);
  } catch (e) {
    console.log(`[docker] rm ${containerName}: ${e.message || 'ignored'}`);
  }
}

export function removeImages(images) {
  for (const image of images) {
    try {
      execSync(`docker rmi ${image}`, { stdio: 'pipe' });
      console.log(`Removed image: ${image}`);
    } catch {
      // Image might be in use by other containers, or already removed — ignore
    }
  }
}

export function runContainer({ image, containerName, targetPort, domain, envVars, memory, cpus, hostPort }) {
  const labels = [
    'traefik.enable=true',
    `traefik.http.routers.${containerName}.rule=Host(\`${domain}\`)`,
    `traefik.http.services.${containerName}.loadbalancer.server.port=${targetPort}`,
  ];

  const envArgs = envVars.map(({ key, value }) => `--env ${key}=${value}`).join(' ');
  const labelArgs = labels.map((l) => `--label "${l}"`).join(' ');
  const resourceArgs = `--memory=${memory || '512m'} --cpus=${cpus || '0.5'} --memory-swap=${memory || '512m'}`;
  const portMap = hostPort ? `-p ${hostPort}:${targetPort}` : '';
  const network = `--network platform_default`;

  const cmd = `docker run -d --name ${containerName} ${network} ${resourceArgs} ${envArgs} ${labelArgs} ${portMap} ${image}`;
  execSync(cmd, { stdio: 'pipe' });
}
