import { connectQueue, popAnyTask } from './queue.js';
import { runDeploy } from './scheduler.js';
import { stopAndRemoveContainer, removeImages } from './docker.js';

async function main() {
  await connectQueue();
  console.log('Deploy Scheduler started, waiting for tasks...');

  // Single loop: BLPOP on deploy:queue and cleanup:queue simultaneously
  while (true) {
    try {
      const { key, task } = await popAnyTask(0);

      if (key === 'deploy:queue') {
        console.log(`Got deploy task: deployId=${task.deployId}, image=${task.image}`);
        await runDeploy(task);
        console.log(`Deploy task completed: deployId=${task.deployId}`);
      } else if (key === 'cleanup:queue') {
        console.log(`Got cleanup task: projectId=${task.projectId}, repo=${task.repoName}`);
        const containerName = `app-${task.repoName}-${task.projectId}`;
        console.log(`Stopping container: ${containerName}`);
        stopAndRemoveContainer(containerName);
        if (task.images && task.images.length > 0) {
          console.log(`Removing images: ${task.images.join(', ')}`);
          removeImages(task.images);
        }
        console.log(`Cleanup completed for project ${task.projectId}`);
      } else if (key === 'stop:queue') {
        console.log(`Got stop task: projectId=${task.projectId}, repo=${task.repoName}`);
        const containerName = `app-${task.repoName}-${task.projectId}`;
        console.log(`Stopping container: ${containerName}`);
        stopAndRemoveContainer(containerName);
        console.log(`Stop completed for project ${task.projectId}`);
      }
    } catch (err) {
      console.error('Deploy scheduler error:', err);
      // Brief pause before retry on error
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

main().catch((err) => {
  console.error('Deploy Scheduler crashed:', err);
  process.exit(1);
});
