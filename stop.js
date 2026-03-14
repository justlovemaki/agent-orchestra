const {
  readPid,
  readRuntime,
  isPidRunning,
  removePidFile,
  updateRuntimeStatus,
  waitForPidExit,
  forceKillAndWait,
  STOP_WAIT_TIMEOUT_MS
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
      
      const waitResult = await waitForPidExit(pid, STOP_WAIT_TIMEOUT_MS);
      
      if (waitResult.exited) {
        await removePidFile();
        if (runtime) {
          await updateRuntimeStatus('stopped', { stopReason: 'normal stop' });
        }
        output({
          success: true,
          stopped: true,
          pid,
          url: runtime?.url || null,
          message: `Agent Orchestra stopped gracefully (pid: ${pid}).`
        });
        process.exit(0);
      } else {
        const killResult = await forceKillAndWait(pid);
        
        if (killResult.exited) {
          await removePidFile();
          if (runtime) {
            await updateRuntimeStatus('stopped', { stopReason: 'force stop (SIGKILL)' });
          }
          output({
            success: true,
            stopped: true,
            pid,
            url: runtime?.url || null,
            forced: true,
            message: `Agent Orchestra stopped forcefully (SIGKILL after SIGTERM timeout) (pid: ${pid}).`
          });
          process.exit(0);
        } else {
          const stillRunning = isPidRunning(pid);
          if (runtime) {
            await updateRuntimeStatus(stillRunning ? 'running' : 'stopped', {
              stopReason: 'force stop failed',
              forceStopFailed: true,
              stillRunning
            });
          }
          output({
            success: false,
            stopped: false,
            pid,
            url: runtime?.url || null,
            forceFailed: true,
            stillRunning,
            message: `Failed to stop Agent Orchestra (pid: ${pid}): SIGTERM timed out, then SIGKILL also failed to terminate the process.`
          });
          process.exit(1);
        }
      }
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
