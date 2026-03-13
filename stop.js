const fs = require('fs').promises;
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const RUNTIME_FILE = path.join(DATA_DIR, 'runtime.json');
const PID_FILE = path.join(DATA_DIR, 'agent-orchestra.pid');

async function readPid() {
  try {
    const text = await fs.readFile(PID_FILE, 'utf8');
    const pid = Number.parseInt(text.trim(), 10);
    return Number.isInteger(pid) ? pid : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readRuntime() {
  try {
    const text = await fs.readFile(RUNTIME_FILE, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

(async () => {
  const pid = await readPid();
  const runtime = await readRuntime();

  if (!pid) {
    console.log('Agent Orchestra is not running (no PID file found).');
    process.exit(0);
  }

  try {
    process.kill(pid, 'SIGTERM');
    console.log(`Sent SIGTERM to Agent Orchestra (pid: ${pid}).`);
    if (runtime?.url) {
      console.log(`Last known URL: ${runtime.url}`);
    }
  } catch (error) {
    if (error.code === 'ESRCH') {
      console.log(`Process ${pid} is not running; PID file is stale.`);
      process.exit(0);
    }
    throw error;
  }
})();
