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

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'EPERM') return true;
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

async function removePidFile() {
  try {
    await fs.unlink(PID_FILE);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function updateRuntimeStopped(runtime) {
  const port = runtime?.port || 3210;
  const data = {
    pid: runtime?.pid || null,
    pidFile: runtime?.pidFile || 'data/agent-orchestra.pid',
    port,
    startedAt: runtime?.startedAt || null,
    url: runtime?.url || `http://127.0.0.1:${port}`,
    status: 'stopped',
    stoppedAt: Date.now(),
    stopReason: 'manual stop'
  };
  await fs.writeFile(RUNTIME_FILE, JSON.stringify(data, null, 2) + '\n');
}

(async () => {
  const pid = await readPid();
  const runtime = await readRuntime();

  if (!pid && !runtime) {
    console.log('Agent Orchestra is not running (no PID file or runtime info found).');
    process.exit(0);
  }

  if (pid && isProcessRunning(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`Sent SIGTERM to Agent Orchestra (pid: ${pid}).`);
      if (runtime?.url) {
        console.log(`Last known URL: ${runtime.url}`);
      }
    } catch (error) {
      if (error.code === 'ESRCH') {
        console.log(`Process ${pid} is not running; cleaning up stale PID...`);
        await removePidFile();
        if (runtime) {
          await updateRuntimeStopped(runtime);
          console.log('Runtime status updated to stopped.');
        }
        process.exit(0);
      }
      throw error;
    }
  } else {
    console.log(`PID ${pid || 'file'} is stale, cleaning up...`);
    await removePidFile();
    if (runtime) {
      await updateRuntimeStopped(runtime);
      console.log('Runtime status updated to stopped.');
    }
    console.log('Cleanup complete.');
    process.exit(0);
  }
})();
