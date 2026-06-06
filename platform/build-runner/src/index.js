import { connectQueue, popBuildTask } from './queue.js';
import { runBuild } from './runner.js';

async function main() {
  await connectQueue();
  console.log('Build Runner started, waiting for tasks...');

  while (true) {
    try {
      const task = await popBuildTask(0); // blocking wait
      console.log(`Got build task: deployId=${task.deployId}`);
      await runBuild(task);
      console.log(`Build task completed: deployId=${task.deployId}`);
    } catch (err) {
      console.error('Build runner error:', err);
      // Continue loop, don't exit
    }
  }
}

main().catch((err) => {
  console.error('Build Runner crashed:', err);
  process.exit(1);
});
