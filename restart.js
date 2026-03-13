const { spawn } = require('child_process');
const path = require('path');

const ROOT = __dirname;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('Stopping Agent Orchestra...');

  const stopProcess = spawn(process.execPath, [path.join(ROOT, 'stop.js')], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  await new Promise((resolve, reject) => {
    stopProcess.on('close', code => {
      if (code === 0 || code === 1) {
        resolve();
      } else {
        reject(new Error(`stop.js exited with code ${code}`));
      }
    });
    stopProcess.on('error', reject);
  });

  console.log('Waiting for cleanup...');
  await sleep(1000);

  console.log('Starting Agent Orchestra...');

  const startProcess = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    stdio: 'inherit',
    detached: false
  });

  startProcess.on('error', error => {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  });

  startProcess.on('close', code => {
    if (code !== 0) {
      console.error(`Server exited with code ${code}`);
      process.exit(code);
    }
  });
})();
