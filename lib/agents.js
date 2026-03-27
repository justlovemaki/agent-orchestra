/**
 * Agents - OpenClaw Agent 管理模块
 * 
 * 功能：
 * - 列出所有 Agent
 * - 获取 Agent 状态
 * - 与 OpenClaw CLI 交互
 */

const { execFile } = require('child_process');

/**
 * 运行 OpenClaw CLI 命令
 * @param {string[]} args - 命令行参数
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runOpenClaw(args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    execFile('openclaw', ['--no-color', ...args], { timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * 解析 OpenClaw agents list 输出
 * @param {string} stdout - CLI 输出
 * @returns {Array} Agent 列表
 */
function parseAgentsList(stdout) {
  const lines = stdout.split('\n').filter(line => line.trim());
  const agents = [];
  
  for (const line of lines) {
    // 跳过标题行和空行
    if (line.includes('ID') || line.includes('──') || !line.trim()) {
      continue;
    }
    
    // 解析表格行（格式：│ id │ identity │ status │ ...）
    const parts = line.split('│').map(p => p.trim()).filter(p => p);
    if (parts.length >= 3) {
      agents.push({
        id: parts[0],
        identity: parts[1] || parts[0],
        status: parts[2]
      });
    }
  }
  
  return agents;
}

/**
 * 列出所有 Agent
 * @returns {Promise<Array>} Agent 列表
 */
async function listAgents() {
  const result = await runOpenClaw(['agents', 'list'], 30000);
  const agentsList = parseAgentsList(result.stdout);
  return agentsList;
}

module.exports = {
  listAgents,
  runOpenClaw,
  parseAgentsList
};
