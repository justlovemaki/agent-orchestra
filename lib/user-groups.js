const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname.endsWith('lib') ? path.resolve(__dirname, '..') : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const USER_GROUPS_FILE = path.join(DATA_DIR, 'user-groups.json');

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(USER_GROUPS_FILE);
  } catch {
    await fs.writeFile(USER_GROUPS_FILE, '[]\n');
  }
}

async function loadUserGroups() {
  await ensureData();
  const data = await fs.readFile(USER_GROUPS_FILE, 'utf8');
  return JSON.parse(data);
}

async function saveUserGroups(groups) {
  await ensureData();
  await fs.writeFile(USER_GROUPS_FILE, JSON.stringify(groups, null, 2) + '\n');
}

async function createUserGroup(name, description, createdBy) {
  if (!name || !name.trim()) {
    throw new Error('用户组名称不能为空');
  }

  const groups = await loadUserGroups();
  const existingGroup = groups.find(g => g.name.toLowerCase() === name.trim().toLowerCase());
  if (existingGroup) {
    throw new Error('用户组名称已存在');
  }

  const now = Date.now();
  const group = {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description?.trim() || '',
    memberIds: [],
    createdAt: now,
    createdBy
  };

  groups.push(group);
  await saveUserGroups(groups);
  return group;
}

async function updateUserGroup(groupId, updates) {
  const groups = await loadUserGroups();
  const idx = groups.findIndex(g => g.id === groupId);
  if (idx === -1) {
    throw new Error('用户组不存在');
  }

  if (updates.name != null) {
    const name = updates.name.trim();
    const existingGroup = groups.find(g => g.name.toLowerCase() === name.toLowerCase() && g.id !== groupId);
    if (existingGroup) {
      throw new Error('用户组名称已存在');
    }
    groups[idx].name = name;
  }
  if (updates.description != null) {
    groups[idx].description = updates.description.trim();
  }

  await saveUserGroups(groups);
  return groups[idx];
}

async function deleteUserGroup(groupId) {
  const groups = await loadUserGroups();
  const idx = groups.findIndex(g => g.id === groupId);
  if (idx === -1) {
    throw new Error('用户组不存在');
  }

  const deletedGroup = groups[idx];
  groups.splice(idx, 1);
  await saveUserGroups(groups);
  return deletedGroup;
}

async function getUserGroup(groupId) {
  const groups = await loadUserGroups();
  return groups.find(g => g.id === groupId) || null;
}

async function getUserGroups() {
  return loadUserGroups();
}

async function addMember(groupId, userId) {
  const groups = await loadUserGroups();
  const idx = groups.findIndex(g => g.id === groupId);
  if (idx === -1) {
    throw new Error('用户组不存在');
  }

  if (!groups[idx].memberIds.includes(userId)) {
    groups[idx].memberIds.push(userId);
    await saveUserGroups(groups);
  }
  return groups[idx];
}

async function removeMember(groupId, userId) {
  const groups = await loadUserGroups();
  const idx = groups.findIndex(g => g.id === groupId);
  if (idx === -1) {
    throw new Error('用户组不存在');
  }

  groups[idx].memberIds = groups[idx].memberIds.filter(id => id !== userId);
  await saveUserGroups(groups);
  return groups[idx];
}

async function getUserGroupsByUserId(userId) {
  const groups = await loadUserGroups();
  return groups.filter(g => g.memberIds.includes(userId));
}

async function removeUserFromAllGroups(userId) {
  const groups = await loadUserGroups();
  let modified = false;
  for (const group of groups) {
    const idx = group.memberIds.indexOf(userId);
    if (idx !== -1) {
      group.memberIds.splice(idx, 1);
      modified = true;
    }
  }
  if (modified) {
    await saveUserGroups(groups);
  }
}

module.exports = {
  createUserGroup,
  updateUserGroup,
  deleteUserGroup,
  getUserGroup,
  getUserGroups,
  addMember,
  removeMember,
  getUserGroupsByUserId,
  removeUserFromAllGroups,
  loadUserGroups,
  saveUserGroups
};