import { createClient } from 'redis';
import { config } from '../config.js';

let client;

export async function connectQueue() {
  client = createClient({ url: config.redisUrl });
  client.on('error', (err) => console.error('Redis client error:', err));
  await client.connect();
  console.log('Redis connected');
  return client;
}

export function getQueueClient() {
  if (!client) throw new Error('Redis not connected. Call connectQueue() first.');
  return client;
}

// Push a build task onto the queue
export async function pushBuildTask(task) {
  await client.rPush('build:queue', JSON.stringify(task));
}

// Blocking pop of a build task (Build Runner uses this)
export async function popBuildTask(timeout = 0) {
  const result = await client.blPop('build:queue', timeout);
  if (!result) return null;
  return JSON.parse(result.element);
}

// Push a deploy task onto the queue
export async function pushDeployTask(task) {
  await client.rPush('deploy:queue', JSON.stringify(task));
}

// Blocking pop of a deploy task (Deploy Scheduler uses this)
export async function popDeployTask(timeout = 0) {
  const result = await client.blPop('deploy:queue', timeout);
  if (!result) return null;
  return JSON.parse(result.element);
}

// Write a build log line
export async function pushBuildLog(deployId, line) {
  await client.rPush(`build:log:${deployId}`, line);
  // Auto-expire log keys after 1 hour
  await client.expire(`build:log:${deployId}`, 3600);
}

// Read a build log line (non-blocking)
export async function popBuildLog(deployId, timeout = 1) {
  const result = await client.blPop(`build:log:${deployId}`, timeout);
  if (!result) return null;
  return result.element;
}

// Get queue lengths for observability
export async function getBuildQueueLength() {
  return client.lLen('build:queue');
}

export async function getDeployQueueLength() {
  return client.lLen('deploy:queue');
}
