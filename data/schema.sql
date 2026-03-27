-- SQLite Database Schema for Agent Orchestra
-- This schema defines all tables for the application

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    lastLoginAt INTEGER,
    groupId TEXT,
    securityQuestion TEXT,
    securityAnswer TEXT,
    twoFactorSecret TEXT,
    twoFactorEnabled INTEGER DEFAULT 0,
    email TEXT
);

-- Tokens table (for session management)
CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    lastUsed INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    prompt TEXT,
    agents TEXT NOT NULL,
    mode TEXT DEFAULT 'broadcast',
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    startedAt INTEGER,
    finishedAt INTEGER,
    createdBy TEXT,
    cancelRequested INTEGER DEFAULT 0,
    runnerPid INTEGER,
    runs TEXT,
    logPath TEXT
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    sessionKey TEXT NOT NULL,
    agentId TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    createdAt INTEGER NOT NULL,
    lastActivity INTEGER,
    metadata TEXT
);

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    steps TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    createdBy TEXT,
    isActive INTEGER DEFAULT 1
);

-- Workflow runs table
CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    workflowId TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    startedAt INTEGER NOT NULL,
    finishedAt INTEGER,
    result TEXT,
    error TEXT,
    FOREIGN KEY (workflowId) REFERENCES workflows(id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    recipient TEXT,
    status TEXT DEFAULT 'pending',
    createdAt INTEGER NOT NULL,
    sentAt INTEGER,
    channel TEXT,
    metadata TEXT
);

-- Agent combinations table
CREATE TABLE IF NOT EXISTS agent_combinations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    agents TEXT NOT NULL,
    description TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    createdBy TEXT,
    usageCount INTEGER DEFAULT 0
);

-- Plugins table
CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    version TEXT,
    status TEXT DEFAULT 'inactive',
    config TEXT,
    loadedAt INTEGER,
    enabled INTEGER DEFAULT 1
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    userId TEXT,
    action TEXT NOT NULL,
    resource TEXT,
    details TEXT,
    ipAddress TEXT,
    userAgent TEXT,
    timestamp INTEGER NOT NULL
);

-- Agent groups table
CREATE TABLE IF NOT EXISTS agent_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    agents TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    createdBy TEXT
);

-- Notification channels table
CREATE TABLE IF NOT EXISTS notification_channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT,
    enabled INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER
);

-- User groups table
CREATE TABLE IF NOT EXISTS user_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    members TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER
);

-- Presets table
CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    isShared INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    createdBy TEXT
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    createdBy TEXT
);

-- Quiet hours config table
CREATE TABLE IF NOT EXISTS quiet_hours_config (
    id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    startTime TEXT,
    endTime TEXT,
    days TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER
);

-- Quiet hours queue table
CREATE TABLE IF NOT EXISTS quiet_hours_queue (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,
    scheduledAt INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    createdAt INTEGER NOT NULL
);

-- Scheduled backup config table
CREATE TABLE IF NOT EXISTS scheduled_backup_config (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    schedule TEXT NOT NULL,
    targetPath TEXT,
    cloudProvider TEXT,
    enabled INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER
);

-- Scheduled backup history table
CREATE TABLE IF NOT EXISTS scheduled_backup_history (
    id TEXT PRIMARY KEY,
    configId TEXT NOT NULL,
    status TEXT NOT NULL,
    startedAt INTEGER NOT NULL,
    finishedAt INTEGER,
    fileSize INTEGER,
    error TEXT,
    FOREIGN KEY (configId) REFERENCES scheduled_backup_config(id)
);

-- Notification history table
CREATE TABLE IF NOT EXISTS notification_history (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    recipient TEXT,
    title TEXT,
    message TEXT,
    status TEXT NOT NULL,
    sentAt INTEGER,
    error TEXT
);

-- Notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER
);

-- Runtime state table
CREATE TABLE IF NOT EXISTS runtime (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    updatedAt INTEGER NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks(createdAt);
CREATE INDEX IF NOT EXISTS idx_sessions_agentId ON sessions(agentId);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflowId ON workflow_runs(workflowId);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_createdAt ON notifications(createdAt);
CREATE INDEX IF NOT EXISTS idx_audit_logs_userId ON audit_logs(userId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_tokens_userId ON tokens(userId);
CREATE INDEX IF NOT EXISTS idx_plugins_type ON plugins(type);
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(status);