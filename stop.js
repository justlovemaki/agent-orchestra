const {
  readPid,
  readRuntime,
  isPidRunning,
  removePidFile,
  updateRuntimeStatus
} = require('./lib/runtime-utils');

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');

function output(result) {
  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.message) console.log(result.message);
    if (result.messages) {
      result.messages.forEach(m => console.log(m));
    }
  }
}

(async () => {
  const pid = await readPid();
  const runtime = await readRuntime();

  if (!pid && !runtime) {
    output({ success: true, stopped: true, pid: null, url: null, message: 'Agent Orchestra is not running (no PID file or runtime info found).' });
    process.exit(0);
  }

  if (pid && isPidRunning(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
      output({
        success: true,
        stopped: true,
        pid,
        url: runtime?.url || null,
        message: `Sent SIGTERM to Agent Orchestra (pid: ${pid}).`
      });
      process.exit(0);
    } catch (error) {
      if (error.code === 'ESRCH') {
        await removePidFile();
        if (runtime) {
          await updateRuntimeStatus('stopped', { stopReason: 'stale pid' });
        }
        output({
          success: true,
          stopped: true,
          pid,
          url: runtime?.url || null,
          message: `Process ${pid} is not running; cleaned stale PID and marked runtime stopped.`
        });
        process.exit(0);
      }
      throw error;
    }
  }

  await removePidFile();
  if (runtime) {
    await updateRuntimeStatus('stopped', { stopReason: 'manual stop' });
  }
  output({
    success: true,
    stopped: true,
    pid: pid || null,
    url: runtime?.url || null,
    message: `PID ${pid || 'file'} is stale; cleaned runtime metadata.`
  });
  process.exit(0);
})();
