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

// Read a build log line (non-blocking, destructive — for backward compat)
export async function popBuildLog(deployId, timeout = 1) {
  const result = await client.blPop(`build:log:${deployId}`, timeout);
  if (!result) return null;
  return result.element;
}

// Read all build log lines from a given index (non-destructive)
export async function getBuildLogs(deployId, start = 0) {
  return client.lRange(`build:log:${deployId}`, start, -1);
}

// Push a cleanup task onto the queue (Deploy Scheduler processes this)
export async function pushCleanupTask(task) {
  await client.rPush('cleanup:queue', JSON.stringify(task));
}

// Push a stop task onto the queue (Deploy Scheduler stops container only)
export async function pushStopTask(task) {
  await client.rPush('stop:queue', JSON.stringify(task));
}

// Delete build log keys from Redis for a list of deploy IDs
export async function deleteBuildLogs(deployIds) {
  if (!deployIds || deployIds.length === 0) return;
  await client.del(deployIds.map(id => `build:log:${id}`));
}

// Get queue lengths for observability
export async function getBuildQueueLength() {
  return client.lLen('build:queue');
}

export async function getDeployQueueLength() {
  return client.lLen('deploy:queue');
}
