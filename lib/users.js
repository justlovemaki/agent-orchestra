const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(USERS_FILE, '[]\n');
  }
  try {
    await fs.access(TOKENS_FILE);
  } catch {
    await fs.writeFile(TOKENS_FILE, '{}');
  }
}

async function loadUsers() {
  await ensureData();
  const data = await fs.readFile(USERS_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveUsers(users) {
  await ensureData();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2) + '\n');
}

async function loadTokens() {
  await ensureData();
  const data = await fs.readFile(TOKENS_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveTokens(tokens) {
  await ensureData();
  await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2) + '\n');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

const VALID_ROLES = ['admin', 'user'];

async function register(name, password) {
  if (!name || !name.trim()) {
    throw new Error('用户名不能为空');
  }
  if (!password || password.length < 4) {
    throw new Error('密码至少需要 4 个字符');
  }

  const users = await loadUsers();
  const existingUser = users.find(u => u.name.toLowerCase() === name.trim().toLowerCase());
  if (existingUser) {
    throw new Error('用户名已存在');
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const user = {
    id,
    name: name.trim(),
    passwordHash: hashPassword(password),
    role: 'user',
    createdAt: now,
    lastLoginAt: null
  };

  users.push(user);
  await saveUsers(users);

  const token = await createToken(user.id);
  return {
    user: { id: user.id, name: user.name, role: user.role, createdAt: user.createdAt },
    token
  };
}

async function login(name, password) {
  if (!name || !name.trim()) {
    throw new Error('用户名不能为空');
  }
  if (!password) {
    throw new Error('密码不能为空');
  }

  const users = await loadUsers();
  const user = users.find(u => u.name.toLowerCase() === name.trim().toLowerCase());
  if (!user) {
    throw new Error('用户名或密码错误');
  }

  const passwordHash = hashPassword(password);
  if (passwordHash !== user.passwordHash) {
    throw new Error('用户名或密码错误');
  }

  const now = Date.now();
  const idx = users.findIndex(u => u.id === user.id);
  users[idx].lastLoginAt = now;
  await saveUsers(users);

  const token = await createToken(user.id);
  return {
    user: { id: user.id, name: user.name, role: user.role, createdAt: user.createdAt, lastLoginAt: now },
    token
  };
}

async function logout(token) {
  const tokens = await loadTokens();
  const userId = tokens[token];
  if (userId) {
    delete tokens[token];
    await saveTokens(tokens);
  }
  return { success: true };
}

async function createToken(userId) {
  const tokens = await loadTokens();
  const token = generateToken();
  tokens[token] = userId;
  await saveTokens(tokens);
  return token;
}

async function verifyToken(token) {
  if (!token) return null;
  const tokens = await loadTokens();
  const userId = tokens[token];
  if (!userId) return null;

  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return null;

  return { id: user.id, name: user.name, role: user.role || 'user', createdAt: user.createdAt };
}

async function getCurrentUser(token) {
  const user = await verifyToken(token);
  if (!user) return null;
  const users = await loadUsers();
  const fullUser = users.find(u => u.id === user.id);
  if (!fullUser) return null;
  return { id: fullUser.id, name: fullUser.name, role: fullUser.role || 'user', createdAt: fullUser.createdAt, lastLoginAt: fullUser.lastLoginAt };
}

async function getUsers() {
  const users = await loadUsers();
  return users.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role || 'user',
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt
  }));
}

async function getUserRole(userId) {
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return null;
  return user.role || 'user';
}

async function isAdmin(userId) {
  const role = await getUserRole(userId);
  return role === 'admin';
}

async function setRole(userId, role, operatorUserId) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`无效的角色，可选值: ${VALID_ROLES.join(', ')}`);
  }
  if (userId === operatorUserId) {
    throw new Error('不能修改自己的角色');
  }
  const users = await loadUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) {
    throw new Error('用户不存在');
  }
  users[idx].role = role;
  await saveUsers(users);
  return { id: users[idx].id, name: users[idx].name, role: users[idx].role };
}

async function setUserGroupId(userId, groupId, operatorUserId) {
  const users = await loadUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) {
    throw new Error('用户不存在');
  }
  const oldGroupId = users[idx].groupId || null;
  users[idx].groupId = groupId || null;
  await saveUsers(users);
  return { id: users[idx].id, name: users[idx].name, role: users[idx].role, groupId: users[idx].groupId };
}

async function getUserById(userId) {
  const users = await loadUsers();
  return users.find(u => u.id === userId) || null;
}

function getUserPermissions(role) {
  const basePermissions = ['view_presets', 'create_presets', 'edit_own_presets', 'delete_own_presets'];
  if (role === 'admin') {
    return [...basePermissions, 'manage_all_presets', 'manage_users', 'view_audit_logs', 'admin_access'];
  }
  return basePermissions;
}

function hashPassword(password) {
  const hash = crypto.createHash('sha256');
  hash.update(password + 'agent-orchestra-salt');
  return hash.digest('hex');
}

function generateTwoFactorSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 16; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)];
  }
  return secret;
}

function generateTwoFactorCode(secret, timestamp) {
  const timeStep = Math.floor((timestamp || Date.now()) / 30000);
  const timeHex = timeStep.toString(16).padStart(16, '0');
  const key = base32ToHex(secret);
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(timeHex);
  const hash = hmac.digest('hex');
  const offset = parseInt(hash.slice(-1), 16) & 0x0f;
  const code = parseInt(hash.slice(offset * 2, offset * 2 + 8), 16) & 0x7fffffff;
  return code.toString().padStart(6, '0').slice(-6);
}

function base32ToHex(base32) {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of base32.toUpperCase()) {
    const val = base32chars.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  let hex = '';
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

async function setSecurityQuestion(userId, question, answer) {
  if (!question || !answer) {
    throw new Error('安全问题与答案不能为空');
  }
  const users = await loadUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) {
    throw new Error('用户不存在');
  }
  users[idx].securityQuestion = question;
  users[idx].securityAnswer = hashPassword(answer);
  await saveUsers(users);
  return { success: true };
}

async function verifySecurityAnswer(userId, answer) {
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user || !user.securityQuestion || !user.securityAnswer) {
    throw new Error('用户未设置安全问题');
  }
  const hashedAnswer = hashPassword(answer);
  if (hashedAnswer !== user.securityAnswer) {
    throw new Error('安全问题答案错误');
  }
  return { verified: true };
}

async function resetPasswordBySecurityQuestion(name, answer, newPassword) {
  if (!name || !name.trim()) {
    throw new Error('用户名不能为空');
  }
  if (!answer) {
    throw new Error('安全问题答案不能为空');
  }
  if (!newPassword || newPassword.length < 4) {
    throw new Error('新密码至少需要 4 个字符');
  }

  const users = await loadUsers();
  const user = users.find(u => u.name.toLowerCase() === name.trim().toLowerCase());
  if (!user) {
    throw new Error('用户名或安全问题答案错误');
  }
  if (!user.securityQuestion || !user.securityAnswer) {
    throw new Error('用户未设置安全问题');
  }

  const hashedAnswer = hashPassword(answer);
  if (hashedAnswer !== user.securityAnswer) {
    throw new Error('用户名或安全问题答案错误');
  }

  const idx = users.findIndex(u => u.id === user.id);
  users[idx].passwordHash = hashPassword(newPassword);
  await saveUsers(users);

  await saveTokens({});
  return { success: true, message: '密码已重置，请重新登录' };
}

async function getUserSessions(userId) {
  const tokens = await loadTokens();
  const userSessions = [];
  for (const [token, tokenUserId] of Object.entries(tokens)) {
    if (tokenUserId === userId) {
      userSessions.push({
        token: token.substring(0, 16) + '...',
        userId: tokenUserId,
        createdAt: null,
        lastUsed: Date.now()
      });
    }
  }
  return userSessions;
}

async function invalidateUserSessions(userId, excludeCurrentToken = null) {
  const tokens = await loadTokens();
  const newTokens = {};
  for (const [token, tokenUserId] of Object.entries(tokens)) {
    if (tokenUserId === userId && token !== excludeCurrentToken) {
      continue;
    }
    newTokens[token] = tokenUserId;
  }
  await saveTokens(newTokens);
  return { success: true };
}

async function invalidateToken(token) {
  const tokens = await loadTokens();
  if (tokens[token]) {
    delete tokens[token];
    await saveTokens(tokens);
  }
  return { success: true };
}

async function generateTwoFactorSetup(userId) {
  const users = await loadUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) {
    throw new Error('用户不存在');
  }

  const secret = generateTwoFactorSecret();
  users[idx].twoFactorSecret = secret;
  await saveUsers(users);

  return {
    secret,
    totpUrl: `otpauth://totp/AgentOrchestra:${users[idx].name}?secret=${secret}&issuer=AgentOrchestra`
  };
}

async function enableTwoFactor(userId, code) {
  const users = await loadUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) {
    throw new Error('用户不存在');
  }

  const user = users[idx];
  if (!user.twoFactorSecret) {
    throw new Error('请先获取验证码');
  }

  const validCode = generateTwoFactorCode(user.twoFactorSecret);
  if (code !== validCode) {
    const currentTimeStep = Math.floor(Date.now() / 30000);
    const prevTimeStep = currentTimeStep - 1;
    const prevCode = generateTwoFactorCode(user.twoFactorSecret, prevTimeStep * 30000);
    if (code !== prevCode) {
      throw new Error('验证码错误');
    }
  }

  users[idx].twoFactorEnabled = true;
  await saveUsers(users);
  return { success: true, message: '双因素认证已启用' };
}

async function disableTwoFactor(userId, code) {
  const users = await loadUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) {
    throw new Error('用户不存在');
  }

  const user = users[idx];
  if (!user.twoFactorEnabled) {
    throw new Error('双因素认证未启用');
  }

  if (!code && !user.twoFactorSecret) {
    users[idx].twoFactorEnabled = false;
    users[idx].twoFactorSecret = null;
    await saveUsers(users);
    return { success: true };
  }

  const validCode = generateTwoFactorCode(user.twoFactorSecret);
  if (code !== validCode) {
    throw new Error('验证码错误');
  }

  users[idx].twoFactorEnabled = false;
  users[idx].twoFactorSecret = null;
  await saveUsers(users);
  return { success: true, message: '双因素认证已禁用' };
}

async function verifyTwoFactorCode(userId, code) {
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new Error('用户未启用双因素认证');
  }

  const validCode = generateTwoFactorCode(user.twoFactorSecret);
  if (code !== validCode) {
    const currentTimeStep = Math.floor(Date.now() / 30000);
    const prevTimeStep = currentTimeStep - 1;
    const prevCode = generateTwoFactorCode(user.twoFactorSecret, prevTimeStep * 30000);
    if (code !== prevCode) {
      throw new Error('验证码错误');
    }
  }

  return { verified: true };
}

async function loginWith2FA(name, password, code) {
  if (!name || !name.trim()) {
    throw new Error('用户名不能为空');
  }
  if (!password) {
    throw new Error('密码不能为空');
  }
  if (!code) {
    throw new Error('验证码不能为空');
  }

  const users = await loadUsers();
  const user = users.find(u => u.name.toLowerCase() === name.trim().toLowerCase());
  if (!user) {
    throw new Error('用户名或密码错误');
  }

  const passwordHash = hashPassword(password);
  if (passwordHash !== user.passwordHash) {
    throw new Error('用户名或密码错误');
  }

  if (user.twoFactorEnabled) {
    const verified = await verifyTwoFactorCode(user.id, code);
    if (!verified.verified) {
      throw new Error('验证码错误');
    }
  } else {
    throw new Error('用户未启用双因素认证');
  }

  const now = Date.now();
  const idx = users.findIndex(u => u.id === user.id);
  users[idx].lastLoginAt = now;
  await saveUsers(users);

  const token = await createToken(user.id);
  return {
    user: { id: user.id, name: user.name, role: user.role, createdAt: user.createdAt, lastLoginAt: now },
    token
  };
}

module.exports = {
  register,
  login,
  logout,
  verifyToken,
  getCurrentUser,
  getUsers,
  getUserRole,
  isAdmin,
  setRole,
  setUserGroupId,
  getUserById,
  getUserPermissions,
  VALID_ROLES,
  createToken,
  loadUsers,
  saveUsers,
  loadTokens,
  saveTokens,
  setSecurityQuestion,
  verifySecurityAnswer,
  resetPasswordBySecurityQuestion,
  getUserSessions,
  invalidateUserSessions,
  invalidateToken,
  generateTwoFactorSetup,
  enableTwoFactor,
  disableTwoFactor,
  verifyTwoFactorCode,
  loginWith2FA
};
