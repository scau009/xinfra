import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client;

export async function connectQueue() {
  client = createClient({ url: REDIS_URL });
  client.on('error', (err) => console.error('Redis client error:', err));
  await client.connect();
  console.log('Redis connected');
  return client;
}

// Blocking pop of a deploy task
export async function popDeployTask(timeout = 0) {
  const result = await client.blPop('deploy:queue', timeout);
  if (!result) return null;
  return JSON.parse(result.element);
}

// Write a build log line
export async function pushBuildLog(deployId, line) {
  await client.rPush(`build:log:${deployId}`, line);
  await client.expire(`build:log:${deployId}`, 3600);
}
