const { readPid, readRuntime, isPidRunning, probeHealth, formatUptime, reconcileRuntimeState } = require('./lib/runtime-utils');

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');

(async () => {
  await reconcileRuntimeState({ stopReason: 'status detected stale runtime' });

  const pid = await readPid();
  const runtime = await readRuntime();

  if (!pid && !runtime) {
    if (jsonMode) {
      console.log(JSON.stringify({ status: 'stopped', running: false, pid: null, port: null, url: null, message: 'Agent Orchestra is not running.' }));
    } else {
      console.log('Agent Orchestra is not running.');
      console.log('No PID file or runtime info found.');
    }
    process.exit(1);
  }

  const processRunning = pid ? isPidRunning(pid) : false;
  const health = await probeHealth(runtime?.url);

  let status = 'stopped';
  if (processRunning && health.ok) {
    status = 'healthy';
  } else if (processRunning || runtime?.status === 'running') {
    status = 'degraded';
  } else {
    status = runtime?.status || 'stopped';
  }

  const result = {
    status,
    running: status !== 'stopped',
    pid: pid || null,
    port: runtime?.port || null,
    url: runtime?.url || null,
    startedAt: runtime?.startedAt || null,
    stoppedAt: runtime?.stoppedAt || null,
    processAlive: processRunning,
    healthOk: health.ok,
    healthUptime: health.ok && health.data ? health.data.startedAt : null,
    warnings: []
  };

  if (!processRunning && pid) {
    result.warnings.push(`PID file exists but process ${pid} is not running.`);
  }

  if (runtime?.status === 'running' && !health.ok) {
    result.warnings.push('runtime metadata says running, but health endpoint is not reachable.');
    if (health.error) {
      result.healthError = health.error;
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('=== Agent Orchestra Status ===');
    console.log(`Status: ${status}`);
    console.log(`PID: ${pid || '—'}`);
    console.log(`Port: ${runtime?.port || '—'}`);
    console.log(`URL: ${runtime?.url || '—'}`);

    if (runtime?.startedAt) {
      console.log(`Started: ${new Date(runtime.startedAt).toLocaleString('zh-CN')}`);
      console.log(`Uptime: ${formatUptime(runtime.startedAt)}`);
    }

    if (runtime?.stoppedAt) {
      console.log(`Stopped: ${new Date(runtime.stoppedAt).toLocaleString('zh-CN')}`);
    }

    console.log(`Process alive: ${processRunning ? 'yes' : 'no'}`);
    console.log(`Health endpoint: ${health.ok ? 'ok' : 'unreachable'}`);

    if (health.ok && health.data) {
      console.log(`Health uptime: ${formatUptime(health.data.startedAt)}`);
    }

    if (!processRunning && pid) {
      console.log(`\nWarning: PID file exists but process ${pid} is not running.`);
      console.log('The PID file may be stale.');
    }

    if (runtime?.status === 'running' && !health.ok) {
      console.log('\nWarning: runtime metadata says running, but health endpoint is not reachable.');
      if (health.error) {
        console.log(`Health probe error: ${health.error}`);
      }
    }
  }

  process.exit(status === 'healthy' ? 0 : 1);
})();
