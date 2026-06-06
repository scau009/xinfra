import { connectQueue, popDeployTask } from './queue.js';
import { runDeploy } from './scheduler.js';

async function main() {
  await connectQueue();
  console.log('Deploy Scheduler started, waiting for tasks...');

  while (true) {
    try {
      const task = await popDeployTask(0); // blocking wait
      console.log(`Got deploy task: deployId=${task.deployId}, image=${task.image}`);
      await runDeploy(task);
      console.log(`Deploy task completed: deployId=${task.deployId}`);
    } catch (err) {
      console.error('Deploy scheduler error:', err);
    }
  }
}

main().catch((err) => {
  console.error('Deploy Scheduler crashed:', err);
  process.exit(1);
});
