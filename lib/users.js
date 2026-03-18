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
    createdAt: now,
    lastLoginAt: null
  };

  users.push(user);
  await saveUsers(users);

  const token = await createToken(user.id);
  return {
    user: { id: user.id, name: user.name, createdAt: user.createdAt },
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
    user: { id: user.id, name: user.name, createdAt: user.createdAt, lastLoginAt: now },
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

  return { id: user.id, name: user.name, createdAt: user.createdAt };
}

async function getCurrentUser(token) {
  const user = await verifyToken(token);
  if (!user) return null;
  const users = await loadUsers();
  const fullUser = users.find(u => u.id === user.id);
  if (!fullUser) return null;
  return { id: fullUser.id, name: fullUser.name, createdAt: fullUser.createdAt, lastLoginAt: fullUser.lastLoginAt };
}

async function getUsers() {
  const users = await loadUsers();
  return users.map(u => ({
    id: u.id,
    name: u.name,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt
  }));
}

function hashPassword(password) {
  const hash = crypto.createHash('sha256');
  hash.update(password + 'agent-orchestra-salt');
  return hash.digest('hex');
}

module.exports = {
  register,
  login,
  logout,
  verifyToken,
  getCurrentUser,
  getUsers,
  createToken,
  loadUsers,
  saveUsers,
  loadTokens,
  saveTokens
};
