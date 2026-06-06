#!/usr/bin/env node
import { login } from './commands/login.js';
import { deploy } from './commands/deploy.js';

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'login':
      await login();
      break;
    case 'deploy':
      await deploy();
      break;
    default:
      console.log(`Plat CLI v0.1.0

Usage:
  plat login    Authenticate with the Plat platform
  plat deploy   Deploy the current project

Example:
  $ cd my-project
  $ plat deploy`);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
