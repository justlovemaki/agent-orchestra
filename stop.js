const {
  readPid,
  readRuntime,
  isPidRunning,
  removePidFile,
  updateRuntimeStatus,
  RUNTIME_FILE
} = require('./lib/runtime-utils');

const fs = require('fs').promises;

(async () => {
  const pid = await readPid();
  const runtime = await readRuntime();

  if (!pid && !runtime) {
    console.log('Agent Orchestra is not running (no PID file or runtime info found).');
    process.exit(0);
  }

  if (pid && isPidRunning(pid)) {
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
          await updateRuntimeStatus('stopped', { stopReason: 'stale pid' });
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
      await updateRuntimeStatus('stopped', { stopReason: 'manual stop' });
      console.log('Runtime status updated to stopped.');
    }
    console.log('Cleanup complete.');
    process.exit(0);
  }
})();
