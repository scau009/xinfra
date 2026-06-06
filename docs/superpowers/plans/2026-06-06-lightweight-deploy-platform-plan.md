# 轻量化自动部署平台 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个面向 vibe coding 用户的轻量化自动部署平台（类 Vercel），支持 GitHub Webhook 自动部署和 CLI 手动上传两条路线。

**Architecture:** 四个核心服务（API Server、Build Runner、Deploy Scheduler、Traefik）+ 两个基础设施（PostgreSQL、Redis），全部通过 docker compose 在单台云主机上编排。服务间通过 Redis 队列解耦，不直接 HTTP 调用。

**Tech Stack:** Node.js 20 (Express)、PostgreSQL 16、Redis 7、Docker Engine + BuildKit、Traefik v3、React 18 (Vite)

**Spec:** `docs/superpowers/specs/2026-06-06-lightweight-deploy-platform-design.md`

---

## 文件结构

```
platform/
├── docker-compose.yml
├── .env.example
├── traefik/
│   └── traefik.yml
├── api-server/
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── index.js
│       ├── config.js
│       ├── db.js
│       ├── routes/
│       │   ├── auth.js
│       │   ├── projects.js
│       │   ├── deploys.js
│       │   ├── cli.js
│       │   └── webhooks.js
│       ├── services/
│       │   ├── github.js
│       │   ├── queue.js
│       │   └── crypto.js
│       └── middleware/
│           ├── jwtAuth.js
│           └── apiKeyAuth.js
├── build-runner/
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── index.js
│       ├── runner.js
│       ├── detectors/
│       │   ├── index.js
│       │   ├── dockerfile.js
│       │   ├── nextjs.js
│       │   ├── nuxt.js
│       │   ├── sveltekit.js
│       │   ├── express.js
│       │   ├── generic-node.js
│       │   └── static.js
│       ├── templates/
│       │   ├── nextjs.dockerfile
│       │   ├── nuxt.dockerfile
│       │   ├── sveltekit.dockerfile
│       │   ├── express.dockerfile
│       │   ├── generic-node.dockerfile
│       │   └── static.dockerfile
│       └── queue.js
├── deploy-scheduler/
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── index.js
│       ├── scheduler.js
│       ├── docker.js
│       ├── env.js
│       └── queue.js
├── cli/
│   ├── package.json
│   ├── README.md
│   └── src/
│       ├── index.js
│       ├── commands/
│       │   ├── login.js
│       │   └── deploy.js
│       ├── api.js
│       ├── auth.js
│       └── pack.js
└── web/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── Dockerfile
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js
        ├── auth.js
        ├── pages/
        │   ├── Login.jsx
        │   ├── Dashboard.jsx
        │   ├── ProjectDetail.jsx
        │   └── DeployLog.jsx
        └── components/
            ├── DeployButton.jsx
            ├── EnvVarForm.jsx
            └── LogStream.jsx
```

---

### Task 1: 项目骨架与 docker compose 编排

**Files:**
- Create: `platform/docker-compose.yml`
- Create: `platform/.env.example`
- Create: `platform/traefik/traefik.yml`

- [ ] **Step 1: 创建 .env.example**

```bash
# platform/.env.example

# PostgreSQL
POSTGRES_USER=plat
POSTGRES_PASSWORD=change-me
POSTGRES_DB=plat

# API Server
JWT_SECRET=change-me-jwt
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=

# Docker Registry (云厂商)
REGISTRY_URL=registry.cn-hangzhou.aliyuncs.com
REGISTRY_NAMESPACE=plat

# Platform domain
PLATFORM_DOMAIN=platform.local

# Let's Encrypt (生产环境替换为真实邮箱)
LETSENCRYPT_EMAIL=admin@example.com
```

- [ ] **Step 2: 创建 Traefik 配置**

```yaml
# platform/traefik/traefik.yml
providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    defaultRule: "Host(`{{ trimPrefix `/` .Name }}.${PLATFORM_DOMAIN}`)"

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: ${LETSENCRYPT_EMAIL}
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web

api:
  dashboard: true
```

- [ ] **Step 3: 创建 docker-compose.yml**

```yaml
# platform/docker-compose.yml
version: "3.8"

services:
  traefik:
    image: traefik:v3.2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - traefik-certs:/letsencrypt
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      retries: 5

  api-server:
    build: ./api-server
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      GITHUB_OAUTH_CLIENT_ID: ${GITHUB_OAUTH_CLIENT_ID}
      GITHUB_OAUTH_CLIENT_SECRET: ${GITHUB_OAUTH_CLIENT_SECRET}
      GITHUB_APP_ID: ${GITHUB_APP_ID}
      GITHUB_APP_PRIVATE_KEY: ${GITHUB_APP_PRIVATE_KEY}
      GITHUB_WEBHOOK_SECRET: ${GITHUB_WEBHOOK_SECRET}
      REGISTRY_URL: ${REGISTRY_URL}
      REGISTRY_NAMESPACE: ${REGISTRY_NAMESPACE}
      PLATFORM_DOMAIN: ${PLATFORM_DOMAIN}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.${PLATFORM_DOMAIN}`)"
      - "traefik.http.services.api.loadbalancer.server.port=3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  build-runner:
    build: ./build-runner
    environment:
      REDIS_URL: redis://redis:6379
      REGISTRY_URL: ${REGISTRY_URL}
      REGISTRY_NAMESPACE: ${REGISTRY_NAMESPACE}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - build-tmp:/tmp/builds
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  deploy-scheduler:
    build: ./deploy-scheduler
    environment:
      REDIS_URL: redis://redis:6379
      REGISTRY_URL: ${REGISTRY_URL}
      REGISTRY_NAMESPACE: ${REGISTRY_NAMESPACE}
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      PLATFORM_DOMAIN: ${PLATFORM_DOMAIN}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
  traefik-certs:
  build-tmp:
```

- [ ] **Step 4: Commit**

```bash
git add platform/docker-compose.yml platform/.env.example platform/traefik/traefik.yml
git commit -m "feat: add docker compose skeleton with traefik config"
```

---

### Task 2: 数据库 Schema 与连接

**Files:**
- Create: `platform/api-server/package.json`
- Create: `platform/api-server/src/config.js`
- Create: `platform/api-server/src/db.js`

- [ ] **Step 1: 创建 api-server package.json**

```json
{
  "name": "plat-api-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "pg": "^8.13.0",
    "redis": "^4.7.0",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.4.5"
  }
}
```

- [ ] **Step 2: 创建 config.js**

```javascript
// platform/api-server/src/config.js
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.example' });

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  encryptionKey: Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(64), 'hex'),
  github: {
    oauthClientId: process.env.GITHUB_OAUTH_CLIENT_ID,
    oauthClientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
    appId: process.env.GITHUB_APP_ID,
    appPrivateKey: process.env.GITHUB_APP_PRIVATE_KEY,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  },
  registry: {
    url: process.env.REGISTRY_URL || 'registry.local',
    namespace: process.env.REGISTRY_NAMESPACE || 'plat',
  },
  platformDomain: process.env.PLATFORM_DOMAIN || 'platform.local',
};
```

- [ ] **Step 3: 创建 db.js（连接 + 初始化表）**

```javascript
// platform/api-server/src/db.js
import pg from 'pg';
import { config } from './config.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    github_id BIGINT UNIQUE,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    avatar_url TEXT,
    api_key VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    repo_url TEXT,
    repo_name VARCHAR(255) NOT NULL,
    source_type VARCHAR(20) NOT NULL DEFAULT 'github',  -- 'github' or 'cli'
    framework VARCHAR(50),
    target_port INTEGER DEFAULT 3000,
    domain VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deploys (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    commit_sha VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending,building,deploying,running,failed
    image_tag VARCHAR(255),
    log_text TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS env_vars (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    key VARCHAR(255) NOT NULL,
    encrypted_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, key)
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_deploys_project_id ON deploys(project_id);
CREATE INDEX IF NOT EXISTS idx_deploys_status ON deploys(status);
`;

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(SCHEMA_SQL);
    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}

export function query(text, params) {
  return pool.query(text, params);
}

export function getClient() {
  return pool.connect();
}
```

- [ ] **Step 4: Commit**

```bash
git add platform/api-server/package.json platform/api-server/src/config.js platform/api-server/src/db.js
git commit -m "feat: add database schema and connection module"
```

---

### Task 3: Redis 队列模块（共享接口）

三个服务（api-server、build-runner、deploy-scheduler）都需要操作 Redis 队列。创建一个共享的队列操作模块，每个服务复制使用。

**Files:**
- Create: `platform/api-server/src/services/queue.js`
- Create: `platform/build-runner/src/queue.js`
- Create: `platform/deploy-scheduler/src/queue.js`

- [ ] **Step 1: 创建队列操作模块（api-server 中使用）**

```javascript
// platform/api-server/src/services/queue.js
import { createClient } from 'redis';
import { config } from '../config.js';

let client;

export async function connectQueue() {
  client = createClient({ url: config.redisUrl });
  client.on('error', (err) => console.error('Redis client error:', err));
  await client.connect();
  console.log('Redis connected');
  return client;
}

export function getQueueClient() {
  if (!client) throw new Error('Redis not connected. Call connectQueue() first.');
  return client;
}

// 投递构建任务
export async function pushBuildTask(task) {
  await client.rPush('build:queue', JSON.stringify(task));
}

// 阻塞取构建任务（Build Runner 用）
export async function popBuildTask(timeout = 0) {
  const result = await client.blPop('build:queue', timeout);
  if (!result) return null;
  return JSON.parse(result.element);
}

// 投递部署任务
export async function pushDeployTask(task) {
  await client.rPush('deploy:queue', JSON.stringify(task));
}

// 阻塞取部署任务（Deploy Scheduler 用）
export async function popDeployTask(timeout = 0) {
  const result = await client.blPop('deploy:queue', timeout);
  if (!result) return null;
  return JSON.parse(result.element);
}

// 写构建日志行
export async function pushBuildLog(deployId, line) {
  await client.rPush(`build:log:${deployId}`, line);
  // 日志 key 1小时后过期，防止泄露
  await client.expire(`build:log:${deployId}`, 3600);
}

// 读构建日志行（非阻塞）
export async function popBuildLog(deployId, timeout = 1) {
  const result = await client.blPop(`build:log:${deployId}`, timeout);
  if (!result) return null;
  return result.element;
}

// 获取队列长度
export async function getBuildQueueLength() {
  return client.lLen('build:queue');
}

export async function getDeployQueueLength() {
  return client.lLen('deploy:queue');
}
```

- [ ] **Step 2: 复制到 build-runner 和 deploy-scheduler**

build-runner 版本：复制同一份文件到 `platform/build-runner/src/queue.js`，仅保留其需要的函数（`connectQueue`, `popBuildTask`, `pushDeployTask`, `pushBuildLog`），以及自己的 config 引用路径。

deploy-scheduler 版本：复制同一份文件到 `platform/deploy-scheduler/src/queue.js`，仅保留其需要的函数（`connectQueue`, `popDeployTask`, `pushBuildLog`），以及自己的 config 引用路径。

- [ ] **Step 3: Commit**

```bash
git add platform/api-server/src/services/queue.js platform/build-runner/src/queue.js platform/deploy-scheduler/src/queue.js
git commit -m "feat: add redis queue module for all three services"
```

---

### Task 4: API Server — GitHub OAuth 登录 + JWT

**Files:**
- Create: `platform/api-server/src/middleware/jwtAuth.js`
- Create: `platform/api-server/src/services/github.js`
- Create: `platform/api-server/src/routes/auth.js`

- [ ] **Step 1: 创建 JWT 中间件**

```javascript
// platform/api-server/src/middleware/jwtAuth.js
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function jwtAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}
```

- [ ] **Step 2: 创建 GitHub 服务封装**

```javascript
// platform/api-server/src/services/github.js
import { config } from '../config.js';

const GITHUB_API = 'https://api.github.com';
const GITHUB_OAUTH = 'https://github.com/login/oauth';

export async function getAccessToken(code) {
  const res = await fetch(`${GITHUB_OAUTH}/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: config.github.oauthClientId,
      client_secret: config.github.oauthClientSecret,
      code,
    }),
  });
  if (!res.ok) throw new Error(`GitHub OAuth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export async function getUserInfo(accessToken) {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GitHub user fetch failed: ${res.status}`);
  return res.json();
}

export async function getUserRepos(accessToken) {
  const res = await fetch(`${GITHUB_API}/user/repos?per_page=100&sort=updated`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GitHub repos fetch failed: ${res.status}`);
  return res.json();
}

export async function getInstallationToken(installationId) {
  // 用 GitHub App 私钥生成 JWT，换取 installation token
  // 首期可以用个人 token 简化，后续实现完整 App 流程
}

export function verifyWebhookSignature(payload, signature) {
  const crypto = await import('crypto');
  const expected = 'sha256=' + crypto.createHmac('sha256', config.github.webhookSecret)
    .update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

- [ ] **Step 3: 创建 auth 路由**

```javascript
// platform/api-server/src/routes/auth.js
import { Router } from 'express';
import { getAccessToken, getUserInfo } from '../services/github.js';
import { query } from '../db.js';
import { signToken } from '../middleware/jwtAuth.js';

const router = Router();

// GET /api/auth/github — 获取 GitHub OAuth 授权 URL
router.get('/github', (req, res) => {
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  res.json({ url });
});

// GET /api/auth/github/callback — GitHub OAuth 回调
router.get('/github/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    const accessToken = await getAccessToken(code);
    const ghUser = await getUserInfo(accessToken);

    // 查找或创建用户
    const existing = await query('SELECT * FROM users WHERE github_id = $1', [ghUser.id]);
    let user;
    if (existing.rows.length > 0) {
      user = existing.rows[0];
      // 更新头像等信息
      await query('UPDATE users SET avatar_url=$1, email=$2 WHERE id=$3',
        [ghUser.avatar_url, ghUser.email, user.id]);
    } else {
      const result = await query(
        'INSERT INTO users (github_id, username, email, avatar_url) VALUES ($1,$2,$3,$4) RETURNING *',
        [ghUser.id, ghUser.login, ghUser.email, ghUser.avatar_url]
      );
      user = result.rows[0];
    }

    const token = signToken({ userId: user.id, username: user.username });
    // 重定向到前端，带上 token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// GET /api/auth/me — 获取当前用户信息（需 JWT）
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const jwt = await import('jsonwebtoken');
    const payload = jwt.default.verify(authHeader.slice(7), process.env.JWT_SECRET);
    const result = await query('SELECT id, github_id, username, email, avatar_url, api_key FROM users WHERE id=$1', [payload.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
```

- [ ] **Step 4: Commit**

```bash
git add platform/api-server/src/middleware/jwtAuth.js platform/api-server/src/services/github.js platform/api-server/src/routes/auth.js
git commit -m "feat: add github oauth login and jwt auth"
```

---

### Task 5: API Server — 项目管理路由

**Files:**
- Create: `platform/api-server/src/routes/projects.js`

- [ ] **Step 1: 创建 projects 路由**

```javascript
// platform/api-server/src/routes/projects.js
import { Router } from 'express';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { query } from '../db.js';
import { pushBuildTask } from '../services/queue.js';

const router = Router();

// GET /api/projects — 当前用户的全部项目
router.get('/', jwtAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM projects WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// POST /api/projects — 创建项目
router.post('/', jwtAuth, async (req, res) => {
  try {
    const { repoUrl, repoName, sourceType } = req.body;
    if (!repoName) return res.status(400).json({ error: 'repoName is required' });

    const domain = `${repoName}.${req.user.username}.${process.env.PLATFORM_DOMAIN || 'platform.local'}`;

    const result = await query(
      `INSERT INTO projects (user_id, repo_url, repo_name, source_type, domain)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.userId, repoUrl || null, repoName, sourceType || 'github', domain]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:id — 项目详情 + 部署历史
router.get('/:id', jwtAuth, async (req, res) => {
  try {
    const project = await query(
      'SELECT * FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const deploys = await query(
      'SELECT * FROM deploys WHERE project_id=$1 ORDER BY created_at DESC LIMIT 20',
      [req.params.id]
    );

    res.json({ ...project.rows[0], deploys: deploys.rows });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// POST /api/projects/:id/deploy — 手动触发部署
router.post('/:id/deploy', jwtAuth, async (req, res) => {
  try {
    // 验证项目所有权
    const project = await query(
      'SELECT * FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    // 创建 deploy 记录
    const deploy = await query(
      `INSERT INTO deploys (project_id, status) VALUES ($1, 'pending') RETURNING *`,
      [req.params.id]
    );

    // 投递构建任务
    await pushBuildTask({
      deployId: deploy.rows[0].id,
      projectId: project.rows[0].id,
      repoUrl: project.rows[0].repo_url,
      repoName: project.rows[0].repo_name,
      sourceType: project.rows[0].source_type,
      domain: project.rows[0].domain,
    });

    res.status(201).json(deploy.rows[0]);
  } catch (err) {
    console.error('Deploy error:', err);
    res.status(500).json({ error: 'Failed to trigger deploy' });
  }
});

// DELETE /api/projects/:id — 删除项目
router.delete('/:id', jwtAuth, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM projects WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add platform/api-server/src/routes/projects.js
git commit -m "feat: add project management routes"
```

---

### Task 6: API Server — 部署日志 SSE 路由

**Files:**
- Create: `platform/api-server/src/routes/deploys.js`

- [ ] **Step 1: 创建 deploys 路由**

```javascript
// platform/api-server/src/routes/deploys.js
import { Router } from 'express';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { query } from '../db.js';
import { popBuildLog } from '../services/queue.js';

const router = Router();

// GET /api/deploys/:id — 查询部署状态
router.get('/:id', jwtAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*, p.user_id FROM deploys d
       JOIN projects p ON d.project_id = p.id
       WHERE d.id=$1 AND p.user_id=$2`,
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Deploy not found' });

    const deploy = result.rows[0];
    delete deploy.user_id; // 不暴露
    res.json(deploy);
  } catch (err) {
    console.error('Get deploy error:', err);
    res.status(500).json({ error: 'Failed to get deploy' });
  }
});

// GET /api/deploys/:id/logs — SSE 实时日志流
router.get('/:id/logs', jwtAuth, async (req, res) => {
  const deployId = req.params.id;

  // 验证所有权
  const deploy = await query(
    `SELECT d.*, p.user_id FROM deploys d
     JOIN projects p ON d.project_id = p.id
     WHERE d.id=$1 AND p.user_id=$2`,
    [deployId, req.user.userId]
  );
  if (deploy.rows.length === 0) {
    return res.status(404).json({ error: 'Deploy not found' });
  }

  // SSE 头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // 先发送已有的 log_text
  if (deploy.rows[0].log_text) {
    res.write(`data: ${JSON.stringify({ type: 'log', line: deploy.rows[0].log_text })}\n\n`);
  }

  // 循环读取 Redis 中的新日志行
  const interval = setInterval(async () => {
    try {
      // 检查部署是否已结束
      const current = await query('SELECT status FROM deploys WHERE id=$1', [deployId]);
      if (current.rows.length === 0) {
        clearInterval(interval);
        res.end();
        return;
      }

      const line = await popBuildLog(deployId, 1);
      if (line) {
        res.write(`data: ${JSON.stringify({ type: 'log', line })}\n\n`);
      }

      const status = current.rows[0].status;
      if (status === 'running' || status === 'failed') {
        res.write(`data: ${JSON.stringify({ type: 'done', status })}\n\n`);
        clearInterval(interval);
        res.end();
      }
    } catch (err) {
      console.error('SSE stream error:', err);
      clearInterval(interval);
      res.end();
    }
  }, 500);

  req.on('close', () => {
    clearInterval(interval);
  });
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add platform/api-server/src/routes/deploys.js
git commit -m "feat: add deploy status and SSE log streaming"
```

---

### Task 7: API Server — Webhook 路由 + CLI 路由

**Files:**
- Create: `platform/api-server/src/routes/webhooks.js`
- Create: `platform/api-server/src/routes/cli.js`
- Create: `platform/api-server/src/middleware/apiKeyAuth.js`

- [ ] **Step 1: 创建 API Key 认证中间件**

```javascript
// platform/api-server/src/middleware/apiKeyAuth.js
import { query } from '../db.js';

export async function apiKeyAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' });
  }
  try {
    const apiKey = header.slice(7);
    const result = await query('SELECT id, username FROM users WHERE api_key=$1', [apiKey]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    req.user = { userId: result.rows[0].id, username: result.rows[0].username };
    next();
  } catch (err) {
    console.error('API key auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}
```

- [ ] **Step 2: 创建 webhooks 路由**

```javascript
// platform/api-server/src/routes/webhooks.js
import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { pushBuildTask } from '../services/queue.js';

const router = Router();

// POST /api/webhooks/github — 接收 GitHub push webhook
router.post('/github', async (req, res) => {
  try {
    // 验证 HMAC 签名
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (secret) {
      const expectedSig = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature || ''))) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // 只处理 push 事件
    const event = req.headers['x-github-event'];
    if (event !== 'push') {
      return res.status(200).json({ message: 'Ignored non-push event' });
    }

    const { repository, head_commit, ref } = req.body;
    const repoUrl = repository.clone_url;
    const branch = ref.replace('refs/heads/', '');
    const commitSha = head_commit?.id;

    // 查找关联此仓库的项目
    const project = await query('SELECT * FROM projects WHERE repo_url=$1', [repoUrl]);
    if (project.rows.length === 0) {
      return res.status(200).json({ message: 'No project for this repo' });
    }

    // 创建 deploy 记录
    const deploy = await query(
      `INSERT INTO deploys (project_id, commit_sha, status) VALUES ($1, $2, 'pending') RETURNING *`,
      [project.rows[0].id, commitSha]
    );

    // 投递构建任务
    await pushBuildTask({
      deployId: deploy.rows[0].id,
      projectId: project.rows[0].id,
      repoUrl: project.rows[0].repo_url,
      repoName: project.rows[0].repo_name,
      sourceType: project.rows[0].source_type,
      branch,
      commitSha,
      domain: project.rows[0].domain,
    });

    res.status(200).json({ message: 'Build queued', deployId: deploy.rows[0].id });
  } catch (err) {
    console.error('Webhook error:', err);
    // GitHub 期望 200，否则会重试
    res.status(200).json({ error: 'Internal error' });
  }
});

export default router;
```

- [ ] **Step 3: 创建 CLI 路由**

```javascript
// platform/api-server/src/routes/cli.js
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { query } from '../db.js';
import { pushBuildTask } from '../services/queue.js';
import { signToken } from '../middleware/jwtAuth.js';

const router = Router();

// multer 配置：接收 tar.gz 上传
const upload = multer({
  dest: path.join(os.tmpdir(), 'plat-uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// POST /api/cli/login — API Key 登录
router.post('/login', apiKeyAuth, (req, res) => {
  const token = signToken({ userId: req.user.userId, username: req.user.username });
  res.json({ token, username: req.user.username });
});

// POST /api/cli/deploy — 上传 tar 包触发部署
router.post('/deploy', apiKeyAuth, upload.single('project'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No project file uploaded' });

    const { repoName, framework } = req.body;
    const name = repoName || `cli-project-${Date.now()}`;

    // 创建或查找项目
    let project = await query(
      'SELECT * FROM projects WHERE repo_name=$1 AND user_id=$2',
      [name, req.user.userId]
    );

    if (project.rows.length === 0) {
      const domain = `${name}.${req.user.username}.${process.env.PLATFORM_DOMAIN || 'platform.local'}`;
      project = await query(
        `INSERT INTO projects (user_id, repo_name, source_type, framework, domain)
         VALUES ($1, $2, 'cli', $3, $4) RETURNING *`,
        [req.user.userId, name, framework || null, domain]
      );
    }

    // 创建 deploy 记录
    const deploy = await query(
      `INSERT INTO deploys (project_id, status) VALUES ($1, 'pending') RETURNING *`,
      [project.rows[0]?.id || project.rows[0].id]
    );

    // 投递构建任务（携带 tar 文件路径）
    await pushBuildTask({
      deployId: deploy.rows[0].id,
      projectId: project.rows[0]?.id || project.rows[0].id,
      repoName: name,
      sourceType: 'cli',
      tarPath: req.file.path,
      domain: project.rows[0]?.domain || project.rows[0].domain,
    });

    res.status(201).json({
      deployId: deploy.rows[0].id,
      message: 'Upload received, build queued',
    });
  } catch (err) {
    console.error('CLI deploy error:', err);
    res.status(500).json({ error: 'Failed to process upload' });
  }
});

export default router;
```

- [ ] **Step 4: Commit**

```bash
git add platform/api-server/src/routes/webhooks.js platform/api-server/src/routes/cli.js platform/api-server/src/middleware/apiKeyAuth.js
git commit -m "feat: add webhook and cli routes"
```

---

### Task 8: API Server — 入口文件 + Dockerfile

**Files:**
- Create: `platform/api-server/src/index.js`
- Create: `platform/api-server/Dockerfile`

- [ ] **Step 1: 创建入口文件 index.js**

```javascript
// platform/api-server/src/index.js
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import { connectQueue } from './services/queue.js';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import deployRoutes from './routes/deploys.js';
import webhookRoutes from './routes/webhooks.js';
import cliRoutes from './routes/cli.js';

async function main() {
  // 初始化数据库
  await initDb();

  // 连接 Redis
  await connectQueue();

  const app = express();

  // 中间件
  app.use(cors());
  // Webhook 路由需要 raw body 做签名验证
  app.use('/api/webhooks', express.raw({ type: 'application/json' }), (req, res, next) => {
    // GitHub sends as application/json, express.raw gives us the buffer
    try {
      req.body = JSON.parse(req.body.toString());
    } catch {
      req.body = {};
    }
    next();
  });
  // 其他路由用 JSON parser
  app.use(express.json());

  // 路由
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/deploys', deployRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/cli', cliRoutes);

  // 健康检查
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.listen(config.port, () => {
    console.log(`API Server listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start API Server:', err);
  process.exit(1);
});
```

- [ ] **Step 2: 创建 api-server Dockerfile**

```dockerfile
# platform/api-server/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY src/ ./src/
EXPOSE 3000
CMD ["node", "src/index.js"]
```

- [ ] **Step 3: Commit**

```bash
git add platform/api-server/src/index.js platform/api-server/Dockerfile
git commit -m "feat: add api-server entry point and dockerfile"
```

---

### Task 9: Build Runner — 主循环与框架检测

**Files:**
- Create: `platform/build-runner/package.json`
- Create: `platform/build-runner/src/index.js`
- Create: `platform/build-runner/src/config.js`
- Create: `platform/build-runner/src/detectors/index.js`
- Create: `platform/build-runner/src/detectors/dockerfile.js`
- Create: `platform/build-runner/src/detectors/nextjs.js`
- Create: `platform/build-runner/src/detectors/express.js`
- Create: `platform/build-runner/src/detectors/generic-node.js`
- Create: `platform/build-runner/src/detectors/static.js`

- [ ] **Step 1: 创建 build-runner package.json**

```json
{
  "name": "plat-build-runner",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": { "start": "node src/index.js" },
  "dependencies": {
    "redis": "^4.7.0",
    "dotenv": "^16.4.5"
  }
}
```

- [ ] **Step 2: 创建 config.js**

```javascript
// platform/build-runner/src/config.js
export const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  registry: {
    url: process.env.REGISTRY_URL || 'registry.local',
    namespace: process.env.REGISTRY_NAMESPACE || 'plat',
  },
};
```

- [ ] **Step 3: 创建框架检测调度器**

```javascript
// platform/build-runner/src/detectors/index.js
import { detectDockerfile } from './dockerfile.js';
import { detectNextJs } from './nextjs.js';
import { detectExpress } from './express.js';
import { detectGenericNode } from './generic-node.js';
import { detectStatic } from './static.js';

// 级联探测：按优先级依次检查
const detectors = [
  detectDockerfile,    // 优先级最高：用户自带了 Dockerfile
  detectNextJs,        // Next.js
  detectExpress,       // Express (在 generic-node 之前，因为有 express 特征)
  detectGenericNode,   // 有 package.json 但无特殊框架
  detectStatic,        // 兜底：当静态站点处理
];

export async function detectFramework(buildDir) {
  for (const detector of detectors) {
    const result = await detector(buildDir);
    if (result) {
      console.log(`Detected framework: ${result.framework}`);
      return result;
    }
  }
  // 理论上 static 兜底总会匹配，这里作为最后防线
  return { framework: 'static', targetPort: 80, needsBuild: false };
}
```

- [ ] **Step 4: 创建 dockerfile 检测器**

```javascript
// platform/build-runner/src/detectors/dockerfile.js
import fs from 'fs/promises';
import path from 'path';

export async function detectDockerfile(buildDir) {
  const dockerfilePath = path.join(buildDir, 'Dockerfile');
  try {
    await fs.access(dockerfilePath);
    return {
      framework: 'custom',
      targetPort: 3000, // 默认，用户可通过其他方式指定
      needsBuild: true,
      hasCustomDockerfile: true,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: 创建 Next.js 检测器**

```javascript
// platform/build-runner/src/detectors/nextjs.js
import fs from 'fs/promises';
import path from 'path';

export async function detectNextJs(buildDir) {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(buildDir, 'package.json'), 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.next) {
      return {
        framework: 'nextjs',
        targetPort: 3000,
        needsBuild: true,
      };
    }
  } catch {}
  return null;
}
```

- [ ] **Step 6: 创建 Express 检测器**

```javascript
// platform/build-runner/src/detectors/express.js
import fs from 'fs/promises';
import path from 'path';

export async function detectExpress(buildDir) {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(buildDir, 'package.json'), 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.express) {
      // 尝试推断入口和端口
      return { framework: 'express', targetPort: 3000, needsBuild: false };
    }
  } catch {}
  return null;
}
```

- [ ] **Step 7: 创建通用 Node 检测器**

```javascript
// platform/build-runner/src/detectors/generic-node.js
import fs from 'fs/promises';
import path from 'path';

export async function detectGenericNode(buildDir) {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(buildDir, 'package.json'), 'utf-8'));
    const hasStartScript = !!(pkg.scripts && pkg.scripts.start);
    return {
      framework: 'generic-node',
      targetPort: process.env.PORT || 3000,
      needsBuild: hasStartScript,
      hasBuildStep: hasStartScript,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 8: 创建静态站点检测器（兜底）**

```javascript
// platform/build-runner/src/detectors/static.js
import fs from 'fs/promises';
import path from 'path';

export async function detectStatic(buildDir) {
  // 只要有 index.html 就当作静态站点
  const candidates = ['index.html', 'dist/index.html', 'public/index.html', 'build/index.html'];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(buildDir, candidate));
      return {
        framework: 'static',
        targetPort: 80,
        needsBuild: false,
        staticRoot: path.dirname(candidate),
      };
    } catch {}
  }
  // 什么特征都没有，仍然尝试作为静态站点（server 整个目录）
  return { framework: 'static', targetPort: 80, needsBuild: false };
}
```

- [ ] **Step 9: Commit**

```bash
git add platform/build-runner/
git commit -m "feat: add build-runner framework detection system"
```

---

### Task 10: Build Runner — Dockerfile 模板与构建执行

**Files:**
- Create: `platform/build-runner/src/templates/` 全部模板
- Create: `platform/build-runner/src/runner.js`
- Create: `platform/build-runner/Dockerfile`

- [ ] **Step 1: 创建 Next.js Dockerfile 模板**

```dockerfile
# platform/build-runner/src/templates/nextjs.dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
EXPOSE 3000
```

- [ ] **Step 2: 创建 Express Dockerfile 模板**

```dockerfile
# platform/build-runner/src/templates/express.dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
ENV NODE_ENV=production
CMD ["node", "index.js"]
EXPOSE 3000
```

- [ ] **Step 3: 创建通用 Node Dockerfile 模板**

```dockerfile
# platform/build-runner/src/templates/generic-node.dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build 2>/dev/null || true
CMD ["npm", "start"]
EXPOSE 3000
```

- [ ] **Step 4: 创建静态站点 Dockerfile 模板**

```dockerfile
# platform/build-runner/src/templates/static.dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 5: 创建 .dockerignore 模板**

```
# platform/build-runner/src/templates/dockerignore
node_modules
.git
.next
.nuxt
dist
build
.env
.env.local
*.log
```

- [ ] **Step 6: 创建构建执行器 runner.js**

```javascript
// platform/build-runner/src/runner.js
import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectFramework } from './detectors/index.js';
import { pushDeployTask, pushBuildLog, updateDeployStatus } from './queue.js';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const BUILDS_DIR = '/tmp/builds';

function getDockerfileTemplate(framework) {
  const templateMap = {
    nextjs: 'nextjs.dockerfile',
    nuxt: 'nuxt.dockerfile',
    sveltekit: 'sveltekit.dockerfile',
    express: 'express.dockerfile',
    'generic-node': 'generic-node.dockerfile',
    static: 'static.dockerfile',
  };
  return templateMap[framework] || 'generic-node.dockerfile';
}

async function log(deployId, message) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const line = `[${timestamp}] ${message}`;
  console.log(`[deploy:${deployId}] ${line}`);
  await pushBuildLog(deployId, line);
}

export async function runBuild(task) {
  const { deployId, projectId, repoUrl, repoName, sourceType, branch, commitSha, tarPath, domain } = task;
  const buildDir = path.join(BUILDS_DIR, `build-${deployId}`);
  const imageName = `${config.registry.url}/${config.registry.namespace}/${repoName}:${deployId}`;
  const cacheImage = `${config.registry.url}/${config.registry.namespace}/${repoName}:cache`;

  try {
    // 1. 获取源码
    await log(deployId, 'Fetching source code...');
    if (sourceType === 'cli' && tarPath) {
      // CLI 上传的 tar.gz
      await fs.mkdir(buildDir, { recursive: true });
      execSync(`tar -xzf ${tarPath} -C ${buildDir}`, { stdio: 'pipe' });
      await fs.unlink(tarPath).catch(() => {}); // 清理临时文件
    } else if (repoUrl) {
      // GitHub: git clone
      execSync(`git clone --depth 1 ${repoUrl} ${buildDir}`, {
        stdio: 'pipe',
        timeout: 120_000,
      });
    } else {
      throw new Error('No source available (no repoUrl and no tarPath)');
    }
    await log(deployId, 'Source code fetched');

    // 2. 检测框架
    await log(deployId, 'Detecting framework...');
    const detected = await detectFramework(buildDir);
    await log(deployId, `Detected: ${detected.framework} (port ${detected.targetPort})`);

    // 3. 写入 Dockerfile（除非用户自定义）
    if (!detected.hasCustomDockerfile) {
      const templatePath = path.join(TEMPLATES_DIR, getDockerfileTemplate(detected.framework));
      const dockerfile = await fs.readFile(templatePath, 'utf-8');
      await fs.writeFile(path.join(buildDir, 'Dockerfile'), dockerfile);
      // 写入 .dockerignore
      const ignorePath = path.join(TEMPLATES_DIR, 'dockerignore');
      await fs.copyFile(ignorePath, path.join(buildDir, '.dockerignore'));
    }

    // 4. Docker build + push
    await log(deployId, 'Building Docker image...');
    const buildPromise = new Promise((resolve, reject) => {
      const args = [
        'buildx', 'build',
        '--cache-from', `type=registry,ref=${cacheImage}`,
        '--cache-to', `type=registry,ref=${cacheImage},mode=max`,
        '-t', imageName,
        '--push',
        buildDir,
      ];

      const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });

      proc.stdout.on('data', async (data) => {
        for (const line of data.toString().trim().split('\n')) {
          if (line) await log(deployId, line);
        }
      });

      proc.stderr.on('data', async (data) => {
        for (const line of data.toString().trim().split('\n')) {
          if (line) await log(deployId, line);
        }
      });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Docker build failed with code ${code}`));
      });
    });

    await buildPromise;
    await log(deployId, 'Build complete, image pushed');

    // 5. 清理
    await fs.rm(buildDir, { recursive: true, force: true });
    await log(deployId, 'Cleaned up build directory');

    // 6. 投递部署任务
    await pushDeployTask({
      deployId,
      projectId,
      image: imageName,
      targetPort: detected.targetPort,
      domain,
      repoName,
    });
    await log(deployId, 'Deploy task queued');
  } catch (err) {
    await log(deployId, `Build failed: ${err.message}`);
    // 更新 deploy 状态为 failed
    await pushBuildLog(deployId, '__STATUS__:failed');
    // 清理
    await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
  }
}
```

- [ ] **Step 7: 创建 build-runner Dockerfile**

```dockerfile
# platform/build-runner/Dockerfile
FROM node:20-alpine
RUN apk add --no-cache docker-cli git
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY src/ ./src/
CMD ["node", "src/index.js"]
```

- [ ] **Step 8: Commit**

```bash
git add platform/build-runner/
git commit -m "feat: add build-runner templates and execution logic"
```

---

### Task 11: Build Runner — 主循环入口

**Files:**
- Create: `platform/build-runner/src/index.js`

- [ ] **Step 1: 创建主循环入口**

```javascript
// platform/build-runner/src/index.js
import { connectQueue, popBuildTask } from './queue.js';
import { runBuild } from './runner.js';

async function main() {
  await connectQueue();
  console.log('Build Runner started, waiting for tasks...');

  while (true) {
    try {
      const task = await popBuildTask(0); // 阻塞等待
      console.log(`Got build task: deployId=${task.deployId}`);
      await runBuild(task);
      console.log(`Build task completed: deployId=${task.deployId}`);
    } catch (err) {
      console.error('Build runner error:', err);
      // 继续循环，不退出
    }
  }
}

main().catch((err) => {
  console.error('Build Runner crashed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add platform/build-runner/src/index.js
git commit -m "feat: add build-runner main loop"
```

---

### Task 12: Deploy Scheduler — 完整实现

**Files:**
- Create: `platform/deploy-scheduler/package.json`
- Create: `platform/deploy-scheduler/src/index.js`
- Create: `platform/deploy-scheduler/src/config.js`
- Create: `platform/deploy-scheduler/src/queue.js`
- Create: `platform/deploy-scheduler/src/env.js`
- Create: `platform/deploy-scheduler/src/scheduler.js`
- Create: `platform/deploy-scheduler/src/docker.js`
- Create: `platform/deploy-scheduler/Dockerfile`

- [ ] **Step 1: 创建 deploy-scheduler package.json**

```json
{
  "name": "plat-deploy-scheduler",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": { "start": "node src/index.js" },
  "dependencies": {
    "redis": "^4.7.0",
    "pg": "^8.13.0",
    "dotenv": "^16.4.5"
  }
}
```

- [ ] **Step 2: 创建 config.js**

```javascript
// platform/deploy-scheduler/src/config.js
export const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  databaseUrl: process.env.DATABASE_URL,
  encryptionKey: Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(64), 'hex'),
  registry: {
    url: process.env.REGISTRY_URL || 'registry.local',
    namespace: process.env.REGISTRY_NAMESPACE || 'plat',
  },
  platformDomain: process.env.PLATFORM_DOMAIN || 'platform.local',
};
```

- [ ] **Step 3: 创建 Docker 操作模块**

```javascript
// platform/deploy-scheduler/src/docker.js
import { execSync } from 'child_process';

export function pullImage(image) {
  execSync(`docker pull ${image}`, { stdio: 'pipe', timeout: 300_000 });
}

export function stopAndRemoveContainer(containerName) {
  try {
    execSync(`docker stop ${containerName}`, { stdio: 'pipe' });
    execSync(`docker rm ${containerName}`, { stdio: 'pipe' });
  } catch {
    // 容器不存在，忽略
  }
}

export function runContainer({ image, containerName, targetPort, domain, envVars, memory, cpus }) {
  const labels = [
    'traefik.enable=true',
    `traefik.http.routers.${containerName}.rule=Host(\`${domain}\`)`,
    `traefik.http.services.${containerName}.loadbalancer.server.port=${targetPort}`,
  ];

  const envArgs = envVars.map(({ key, value }) => `--env ${key}=${value}`).join(' ');
  const labelArgs = labels.map((l) => `--label "${l}"`).join(' ');
  const resourceArgs = `--memory=${memory || '512m'} --cpus=${cpus || '0.5'} --memory-swap=${memory || '512m'}`;

  const cmd = `docker run -d --name ${containerName} ${resourceArgs} ${envArgs} ${labelArgs} ${image}`;
  execSync(cmd, { stdio: 'pipe' });
}
```

- [ ] **Step 4: 创建环境变量解密模块**

```javascript
// platform/deploy-scheduler/src/env.js
import crypto from 'crypto';
import pg from 'pg';
import { config } from './config.js';

export async function getDecryptedEnvVars(projectId) {
  // 这里直接连数据库查询 env_vars
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT key, encrypted_value FROM env_vars WHERE project_id=$1',
      [projectId]
    );

    return result.rows.map((row) => {
      // AES-256-GCM 解密
      const encrypted = Buffer.from(row.encrypted_value, 'base64');
      const iv = encrypted.subarray(0, 12);
      const tag = encrypted.subarray(encrypted.length - 16);
      const ciphertext = encrypted.subarray(12, encrypted.length - 16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', config.encryptionKey, iv);
      decipher.setAuthTag(tag);
      let plaintext = decipher.update(ciphertext, null, 'utf-8');
      plaintext += decipher.final('utf-8');

      return { key: row.key, value: plaintext };
    });
  } finally {
    client.release();
    await pool.end();
  }
}
```

- [ ] **Step 5: 创建调度器 scheduler.js**

```javascript
// platform/deploy-scheduler/src/scheduler.js
import { pullImage, stopAndRemoveContainer, runContainer } from './docker.js';
import { getDecryptedEnvVars } from './env.js';
import { pushBuildLog } from './queue.js';

export async function runDeploy(task) {
  const { deployId, projectId, image, targetPort, domain, repoName } = task;
  const containerName = `app-${repoName}-${projectId}`;

  try {
    await log(deployId, 'Pulling image...');
    pullImage(image);
    await log(deployId, 'Image pulled');

    await log(deployId, 'Stopping old container...');
    stopAndRemoveContainer(containerName);

    await log(deployId, 'Loading environment variables...');
    const envVars = await getDecryptedEnvVars(projectId);
    // 加入平台默认注入的变量
    envVars.push({ key: 'PLATFORM_APP_URL', value: `https://${domain}` });
    envVars.push({ key: 'PORT', value: String(targetPort) });

    await log(deployId, 'Starting container...');
    runContainer({ image, containerName, targetPort, domain, envVars });
    await log(deployId, 'Container started');

    await log(deployId, `Deploy complete! https://${domain}`);
    await pushBuildLog(deployId, '__STATUS__:running');
  } catch (err) {
    await log(deployId, `Deploy failed: ${err.message}`);
    await pushBuildLog(deployId, '__STATUS__:failed');
  }
}

async function log(deployId, message) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const line = `[${timestamp}] ${message}`;
  console.log(`[deploy:${deployId}] ${line}`);
  await pushBuildLog(deployId, line);
}
```

- [ ] **Step 6: 创建主循环入口**

```javascript
// platform/deploy-scheduler/src/index.js
import { connectQueue, popDeployTask } from './queue.js';
import { runDeploy } from './scheduler.js';

async function main() {
  await connectQueue();
  console.log('Deploy Scheduler started, waiting for tasks...');

  while (true) {
    try {
      const task = await popDeployTask(0); // 阻塞等待
      console.log(`Got deploy task: deployId=${task.deployId}, image=${task.image}`);
      await runDeploy(task);
      console.log(`Deploy task completed: deployId=${task.deployId}`);
    } catch (err) {
      console.error('Deploy scheduler error:', err);
    }
  }
}

main().catch((err) => {
  console.error('Deploy Scheduler crashed:', err);
  process.exit(1);
});
```

- [ ] **Step 7: 创建 Dockerfile**

```dockerfile
# platform/deploy-scheduler/Dockerfile
FROM node:20-alpine
RUN apk add --no-cache docker-cli
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY src/ ./src/
CMD ["node", "src/index.js"]
```

- [ ] **Step 8: 复制 queue.js**

将 Task 3 中创建的 deploy-scheduler 版 `queue.js` 放入 `platform/deploy-scheduler/src/queue.js`。（`connectQueue`, `popDeployTask`, `pushBuildLog`）

- [ ] **Step 9: Commit**

```bash
git add platform/deploy-scheduler/
git commit -m "feat: add deploy scheduler with docker orchestration and env var injection"
```

---

### Task 13: CLI 工具 — 核心功能

**Files:**
- Create: `platform/cli/package.json`
- Create: `platform/cli/src/index.js`
- Create: `platform/cli/src/auth.js`
- Create: `platform/cli/src/api.js`
- Create: `platform/cli/src/pack.js`
- Create: `platform/cli/src/commands/login.js`
- Create: `platform/cli/src/commands/deploy.js`
- Create: `platform/cli/README.md`

- [ ] **Step 1: 创建 CLI package.json**

```json
{
  "name": "plat-cli",
  "version": "0.1.0",
  "description": "CLI tool for Plat deploy platform",
  "type": "module",
  "bin": {
    "plat": "./src/index.js"
  },
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "tar": "^7.4.0"
  }
}
```

- [ ] **Step 2: 创建 CLI 入口**

```javascript
// platform/cli/src/index.js
#!/usr/bin/env node
import { login } from './commands/login.js';
import { deploy } from './commands/deploy.js';

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'login':
      await login();
      break;
    case 'deploy':
      await deploy();
      break;
    default:
      console.log(`Plat CLI v0.1.0

Usage:
  plat login    Authenticate with the Plat platform
  plat deploy   Deploy the current project

Example:
  $ cd my-project
  $ plat deploy`);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 3: 创建 auth 模块**

```javascript
// platform/cli/src/auth.js
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.platrc');

export function getApiKey() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    return config.apiKey;
  } catch {
    return null;
  }
}

export function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  fs.chmodSync(CONFIG_PATH, 0o600); // 仅所有者可读写
}
```

- [ ] **Step 4: 创建 API 客户端**

```javascript
// platform/cli/src/api.js
import { getApiKey } from './auth.js';

const BASE_URL = process.env.PLAT_API_URL || 'https://api.platform.local';

export async function apiLogin(apiKey) {
  const res = await fetch(`${BASE_URL}/api/cli/login`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return res.json();
}

export async function uploadProject(apiKey, tarPath, repoName) {
  const formData = new FormData();
  const blob = new Blob([await (await import('fs')).promises.readFile(tarPath)]);
  formData.append('project', blob, `${repoName}.tar.gz`);
  formData.append('repoName', repoName);

  const res = await fetch(`${BASE_URL}/api/cli/deploy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export async function pollDeploy(token, deployId) {
  const res = await fetch(`${BASE_URL}/api/deploys/${deployId}/logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'log') {
          console.log(data.line);
        } else if (data.type === 'done') {
          return data.status;
        }
      } catch {}
    }
  }
  return 'unknown';
}
```

- [ ] **Step 5: 创建打包模块**

```javascript
// platform/cli/src/pack.js
import { execSync } from 'child_process';
import path from 'path';
import os from 'os';

export function createTarGz(projectDir) {
  const name = path.basename(projectDir);
  const tarPath = path.join(os.tmpdir(), `${name}-${Date.now()}.tar.gz`);

  // tar 排除 node_modules, .git, .next, .nuxt, dist, build, .env
  execSync(
    `tar -czf ${tarPath} --exclude='node_modules' --exclude='.git' --exclude='.next' --exclude='.nuxt' --exclude='dist' --exclude='build' --exclude='.env' --exclude='*.log' -C ${path.dirname(projectDir)} ${name}`,
    { stdio: 'pipe' }
  );

  return { tarPath, repoName: name };
}
```

- [ ] **Step 6: 创建 login 命令**

```javascript
// platform/cli/src/commands/login.js
import readline from 'readline';
import { saveConfig, getApiKey } from '../auth.js';
import { apiLogin } from '../api.js';

export async function login() {
  const existingKey = getApiKey();
  if (existingKey) {
    console.log('Already logged in. To re-login, delete ~/.platrc first.');
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  console.log('Get your API Key from: https://platform.local/settings/api-key');
  const apiKey = await ask('Paste your API Key: ');
  rl.close();

  if (!apiKey.trim()) {
    console.error('API Key is required');
    process.exit(1);
  }

  const result = await apiLogin(apiKey.trim());
  saveConfig({ apiKey: apiKey.trim(), username: result.username });
  console.log(`Logged in as ${result.username}`);
}
```

- [ ] **Step 7: 创建 deploy 命令**

```javascript
// platform/cli/src/commands/deploy.js
import { getApiKey } from '../auth.js';
import { createTarGz } from '../pack.js';
import { uploadProject, pollDeploy } from '../api.js';
import { apiLogin } from '../api.js';
import fs from 'fs';

export async function deploy() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Not logged in. Run "plat login" first.');
    process.exit(1);
  }

  // 用 API Key 换取 token
  const auth = await apiLogin(apiKey);

  const projectDir = process.cwd();
  const repoName = process.argv[3] || require('path').basename(projectDir);

  console.log(`Deploying "${repoName}"...`);

  // 打包
  const { tarPath } = createTarGz(projectDir);

  // 上传
  console.log('Uploading project...');
  const result = await uploadProject(apiKey, tarPath, repoName);

  // 清理 tar 文件
  fs.unlinkSync(tarPath);

  console.log(`Build queued: deploy #${result.deployId}`);

  // 实时追踪日志
  const status = await pollDeploy(auth.token, result.deployId);

  if (status === 'running') {
    console.log(`\n✅ Deploy successful!`);
  } else {
    console.log(`\n❌ Deploy failed`);
    process.exit(1);
  }
}
```

- [ ] **Step 8: 创建 CLI README**

```markdown
# Plat CLI

轻量化自动部署平台的命令行工具。

## 安装

npm i -g plat-cli

## 使用

plat login   # 登录平台（需要从平台获取 API Key）
plat deploy  # 部署当前目录的项目
```

- [ ] **Step 9: Commit**

```bash
git add platform/cli/
git commit -m "feat: add cli tool with login and deploy commands"
```

---

### Task 14: 环境变量加解密模块（API Server）

**Files:**
- Create: `platform/api-server/src/services/crypto.js`

- [ ] **Step 1: 创建加密模块**

```javascript
// platform/api-server/src/services/crypto.js
import crypto from 'crypto';
import { config } from '../config.js';

export function encryptEnvVar(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', config.encryptionKey, iv);
  let encrypted = cipher.update(plaintext, 'utf-8', null);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();
  // 格式: iv + ciphertext + tag
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

export function decryptEnvVar(encryptedBase64) {
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const iv = encrypted.subarray(0, 12);
  const tag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(12, encrypted.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', config.encryptionKey, iv);
  decipher.setAuthTag(tag);
  let plaintext = decipher.update(ciphertext, null, 'utf-8');
  plaintext += decipher.final('utf-8');
  return plaintext;
}
```

- [ ] **Step 2: Commit**

```bash
git add platform/api-server/src/services/crypto.js
git commit -m "feat: add env var encryption/decryption module"
```

---

### Task 15: 前端 — 登录与项目仪表盘

**Files:**
- Create: `platform/web/package.json`
- Create: `platform/web/vite.config.js`
- Create: `platform/web/index.html`
- Create: `platform/web/src/main.jsx`
- Create: `platform/web/src/App.jsx`
- Create: `platform/web/src/api.js`
- Create: `platform/web/src/auth.js`
- Create: `platform/web/src/pages/Login.jsx`
- Create: `platform/web/src/pages/Dashboard.jsx`

- [ ] **Step 1: 创建 web package.json**

```json
{
  "name": "plat-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: 创建 vite.config.js**

```javascript
// platform/web/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

- [ ] **Step 3: 创建 index.html**

```html
<!-- platform/web/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Plat — Deploy your code in seconds</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: 创建 main.jsx + App.jsx**

```jsx
// platform/web/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

```jsx
// platform/web/src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import { getToken } from './auth';

export default function App() {
  const isLoggedIn = !!getToken();

  return (
    <Routes>
      <Route path="/auth/callback" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={isLoggedIn ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/projects/:id" element={isLoggedIn ? <ProjectDetail /> : <Navigate to="/login" />} />
    </Routes>
  );
}
```

- [ ] **Step 5: 创建 auth.js**

```javascript
// platform/web/src/auth.js
const TOKEN_KEY = 'plat_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
```

- [ ] **Step 6: 创建 api.js**

```javascript
// platform/web/src/api.js
import { getToken } from './auth';

const BASE = ''; // Vite proxy handles /api

async function request(path, options = {}) {
  const headers = { ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('plat_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error);
  }
  return res.json();
}

export const api = {
  // Auth
  getLoginUrl: () => request('/api/auth/github'),
  getMe: () => request('/api/auth/me'),

  // Projects
  listProjects: () => request('/api/projects'),
  createProject: (data) => request('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id) => request(`/api/projects/${id}`),
  deployProject: (id) => request(`/api/projects/${id}/deploy`, { method: 'POST' }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: 'DELETE' }),

  // Deploys
  getDeploy: (id) => request(`/api/deploys/${id}`),
};
```

- [ ] **Step 7: 创建 Login 页面**

```jsx
// platform/web/src/pages/Login.jsx
import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { setToken, getToken } from '../auth';
import { api } from '../api';

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // 检查是否从 GitHub OAuth 回调返回
    const token = params.get('token');
    if (token) {
      setToken(token);
      navigate('/');
      return;
    }

    // 已登录则跳转
    if (getToken()) {
      navigate('/');
    }
  }, []);

  async function handleLogin() {
    const { url } = await api.getLoginUrl();
    window.location.href = url;
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Plat</h1>
        <p style={styles.subtitle}>Deploy your code in seconds. Zero config.</p>
        <button onClick={handleLogin} style={styles.button}>
          Login with GitHub
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#fff',
    fontFamily: 'system-ui, sans-serif',
  },
  card: { textAlign: 'center', maxWidth: '400px' },
  title: { fontSize: '48px', fontWeight: 700, margin: '0 0 8px' },
  subtitle: { color: '#888', fontSize: '18px', marginBottom: '32px' },
  button: {
    padding: '12px 32px', fontSize: '16px', fontWeight: 600,
    backgroundColor: '#fff', color: '#000', border: 'none',
    borderRadius: '8px', cursor: 'pointer',
  },
};
```

- [ ] **Step 8: 创建 Dashboard 页面**

```jsx
// platform/web/src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { clearToken } from '../auth';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');

  useEffect(() => {
    api.listProjects().then(setProjects).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const url = new URL(repoUrl);
    const repoName = url.pathname.split('/').pop()?.replace('.git', '') || 'unnamed';
    const project = await api.createProject({ repoUrl, repoName, sourceType: 'github' });
    // 触发首次部署
    await api.deployProject(project.id);
    setProjects([project, ...projects]);
    setShowCreate(false);
    setRepoUrl('');
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Plat</h1>
        <button onClick={clearToken} style={styles.logoutBtn}>Logout</button>
      </header>

      <div style={styles.content}>
        <div style={styles.topBar}>
          <h2>Projects</h2>
          <button onClick={() => setShowCreate(!showCreate)} style={styles.addBtn}>
            + New Project
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} style={styles.createForm}>
            <input
              type="text" value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              style={styles.input}
            />
            <button type="submit" style={styles.createBtn}>Create & Deploy</button>
          </form>
        )}

        {loading ? <p>Loading...</p> : projects.length === 0 ? (
          <p style={styles.empty}>No projects yet. Create your first one.</p>
        ) : (
          <div>
            {projects.map((p) => (
              <Link to={`/projects/${p.id}`} key={p.id} style={styles.projectCard}>
                <div>
                  <strong>{p.repo_name}</strong>
                  <span style={styles.domain}>{p.domain}</span>
                </div>
                <span style={styles.arrow}>→</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'system-ui' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #222' },
  logoutBtn: { padding: '6px 16px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  content: { maxWidth: '720px', margin: '0 auto', padding: '32px 16px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  addBtn: { padding: '8px 20px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' },
  createForm: { display: 'flex', gap: '8px', marginBottom: '24px' },
  input: { flex: 1, padding: '10px 16px', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '8px', fontSize: '14px' },
  createBtn: { padding: '10px 20px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  empty: { color: '#666', textAlign: 'center', marginTop: '64px' },
  projectCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', marginBottom: '8px', textDecoration: 'none', color: '#fff' },
  domain: { display: 'block', color: '#666', fontSize: '13px', marginTop: '4px' },
  arrow: { fontSize: '20px', color: '#666' },
};
```

- [ ] **Step 9: Commit**

```bash
git add platform/web/
git commit -m "feat: add web frontend with login and dashboard"
```

---

### Task 16: 前端 — 项目详情与部署日志

**Files:**
- Create: `platform/web/src/pages/ProjectDetail.jsx`
- Create: `platform/web/src/pages/DeployLog.jsx`
- Create: `platform/web/src/components/DeployButton.jsx`
- Create: `platform/web/src/components/EnvVarForm.jsx`
- Create: `platform/web/src/components/LogStream.jsx`

- [ ] **Step 1: 创建 ProjectDetail 页面**

```jsx
// platform/web/src/pages/ProjectDetail.jsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import DeployButton from '../components/DeployButton';
import EnvVarForm from '../components/EnvVarForm';
import DeployLog from './DeployLog';

const STATUS_COLORS = {
  pending: '#888',
  building: '#f0a500',
  deploying: '#f0a500',
  running: '#00c853',
  failed: '#ff1744',
};

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDeployId, setActiveDeployId] = useState(null);

  async function load() {
    try {
      const data = await api.getProject(id);
      setProject(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleDeploy() {
    const deploy = await api.deployProject(id);
    setActiveDeployId(deploy.id);
    await load(); // 刷新部署列表
  }

  if (loading) return <div style={styles.container}><p>Loading...</p></div>;
  if (error) return <div style={styles.container}><p style={{color:'red'}}>{error}</p></div>;
  if (!project) return <div style={styles.container}><p>Project not found</p></div>;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link to="/" style={styles.back}>← Back</Link>
        <h1>{project.repo_name}</h1>
      </header>

      <div style={styles.content}>
        <div style={styles.meta}>
          <span>Domain: <a href={`https://${project.domain}`} target="_blank" rel="noopener">{project.domain}</a></span>
          <span>Framework: {project.framework || 'auto-detect'}</span>
        </div>

        <DeployButton onDeploy={handleDeploy} hasRunningDeploy={project.deploys?.some(d => d.status === 'building' || d.status === 'deploying')} />

        {activeDeployId && (
          <DeployLog deployId={activeDeployId} onComplete={load} />
        )}

        <h2 style={{ marginTop: '32px' }}>Deploy History</h2>
        {(!project.deploys || project.deploys.length === 0) ? (
          <p style={styles.empty}>No deploys yet</p>
        ) : (
          <div>
            {project.deploys.map((d) => (
              <div key={d.id} style={styles.deployRow} onClick={() => setActiveDeployId(d.id)}>
                <div>
                  <span style={{ ...styles.statusDot, backgroundColor: STATUS_COLORS[d.status] || '#888' }} />
                  <strong style={{ marginLeft: '8px' }}>{d.status}</strong>
                </div>
                <div style={styles.deployMeta}>
                  {d.commit_sha ? d.commit_sha.slice(0, 7) : 'manual'}
                  <span style={{ marginLeft: '12px', color: '#666' }}>
                    {new Date(d.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ marginTop: '32px' }}>Environment Variables</h2>
        <EnvVarForm projectId={project.id} />
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'system-ui' },
  header: { padding: '16px 32px', borderBottom: '1px solid #222' },
  back: { color: '#888', textDecoration: 'none', fontSize: '14px' },
  content: { maxWidth: '720px', margin: '0 auto', padding: '32px 16px' },
  meta: { display: 'flex', gap: '24px', color: '#888', fontSize: '14px', marginBottom: '24px' },
  metaLink: { color: '#4da6ff' },
  empty: { color: '#666', textAlign: 'center', marginTop: '32px' },
  deployRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer' },
  statusDot: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%' },
  deployMeta: { color: '#888', fontSize: '13px' },
};
```

- [ ] **Step 2: 创建 DeployButton 组件**

```jsx
// platform/web/src/components/DeployButton.jsx
export default function DeployButton({ onDeploy, hasRunningDeploy }) {
  return (
    <button
      onClick={onDeploy}
      disabled={hasRunningDeploy}
      style={{
        padding: '10px 24px', fontSize: '15px', fontWeight: 600,
        backgroundColor: hasRunningDeploy ? '#333' : '#fff',
        color: hasRunningDeploy ? '#888' : '#000',
        border: 'none', borderRadius: '8px', cursor: hasRunningDeploy ? 'not-allowed' : 'pointer',
      }}
    >
      {hasRunningDeploy ? 'Deploying...' : 'Deploy'}
    </button>
  );
}
```

- [ ] **Step 3: 创建 DeployLog 组件（SSE 日志流）**

```jsx
// platform/web/src/pages/DeployLog.jsx
import { useEffect, useRef, useState } from 'react';
import { getToken } from '../auth';

export default function DeployLog({ deployId, onComplete }) {
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const token = getToken();
    const es = new EventSource(`/api/deploys/${deployId}/logs`, {
      // SSE 不支持自定义 header，通过查询参数或其他方式传 token
      // 实际实现中 API Server 可以通过 cookie 读 JWT
      // 这里简化：修改 API Server 允许 query param 传 token
    });

    // 使用 fetch + ReadableStream 代替 EventSource（EventSource 不支持 Authorization header）
    async function fetchLogs() {
      const res = await fetch(`/api/deploys/${deployId}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(part.slice(6));
            if (data.type === 'log') {
              setLines((prev) => [...prev, data.line]);
            } else if (data.type === 'done') {
              setStatus(data.status);
            }
          } catch {}
        }
      }
    }

    fetchLogs().catch(console.error);

    return () => {
      // cleanup handled by fetch completing
    };
  }, [deployId]);

  useEffect(() => {
    if (status && onComplete) onComplete();
  }, [status]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div style={{
      backgroundColor: '#0d1117', color: '#c9d1d9', fontFamily: 'monospace', fontSize: '13px',
      padding: '16px', borderRadius: '8px', maxHeight: '320px', overflow: 'auto', marginTop: '16px',
    }} ref={containerRef}>
      {lines.map((line, i) => (
        <div key={i} style={{ lineHeight: '1.6' }}>{line}</div>
      ))}
      {status && (
        <div style={{
          marginTop: '12px', padding: '8px', borderRadius: '4px',
          backgroundColor: status === 'running' ? '#052e16' : '#450a0a',
          color: status === 'running' ? '#4ade80' : '#f87171',
        }}>
          {status === 'running' ? '✅ Deploy successful!' : '❌ Deploy failed'}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 创建 EnvVarForm 组件**

```jsx
// platform/web/src/components/EnvVarForm.jsx
import { useState, useEffect } from 'react';

export default function EnvVarForm({ projectId }) {
  const [vars, setVars] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    fetch(`/api/projects/${projectId}/env`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('plat_token')}` },
    }).then(r => r.json()).then(setVars).catch(() => {});
  }, [projectId]);

  async function addVar(e) {
    e.preventDefault();
    if (!newKey.trim()) return;
    await fetch(`/api/projects/${projectId}/env`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('plat_token')}`,
      },
      body: JSON.stringify({ key: newKey.trim(), value: newValue }),
    });
    setVars([...vars, { key: newKey.trim() }]);
    setNewKey('');
    setNewValue('');
  }

  async function deleteVar(key) {
    await fetch(`/api/projects/${projectId}/env/${key}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('plat_token')}` },
    });
    setVars(vars.filter(v => v.key !== key));
  }

  return (
    <div>
      {vars.map((v) => (
        <div key={v.key} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
          <code style={{ flex: 1 }}>{v.key}</code>
          <span style={{ color: '#666', marginRight: '12px' }}>••••••••</span>
          <button onClick={() => deleteVar(v.key)} style={{ color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
        </div>
      ))}
      <form onSubmit={addVar} style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="KEY" style={inputStyle} />
        <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="VALUE" style={{ ...inputStyle, flex: 2 }} />
        <button type="submit" style={addBtnStyle}>Add</button>
      </form>
    </div>
  );
}

const inputStyle = {
  padding: '8px 12px', backgroundColor: '#1a1a1a', color: '#fff',
  border: '1px solid #333', borderRadius: '6px', fontSize: '13px',
};
const addBtnStyle = {
  padding: '8px 16px', backgroundColor: '#fff', color: '#000',
  border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer',
};
```

- [ ] **Step 5: 创建 Web 的 Dockerfile**

```dockerfile
# platform/web/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

- [ ] **Step 6: Commit**

```bash
git add platform/web/
git commit -m "feat: add project detail, deploy log, env var management UI"
```

---

### Task 17: 环境变量管理 API（补充 API Server）

**Files:**
- Modify: `platform/api-server/src/routes/projects.js`
- Modify: `platform/api-server/src/index.js` (如果 routes 单独引入)

- [ ] **Step 1: 在 projects 路由中添加环境变量 CRUD**

在 `platform/api-server/src/routes/projects.js` 末尾追加以下路由：

```javascript
// 追加到 projects.js 中

import { encryptEnvVar, decryptEnvVar } from '../services/crypto.js';

// GET /api/projects/:id/env — 列出环境变量（key 和 masked value）
router.get('/:id/env', jwtAuth, async (req, res) => {
  try {
    const project = await query('SELECT * FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const vars = await query('SELECT id, key FROM env_vars WHERE project_id=$1 ORDER BY key',
      [req.params.id]);
    res.json(vars.rows); // 不返回 encrypted_value
  } catch (err) {
    console.error('List env vars error:', err);
    res.status(500).json({ error: 'Failed to list env vars' });
  }
});

// POST /api/projects/:id/env — 添加或更新环境变量
router.post('/:id/env', jwtAuth, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const project = await query('SELECT * FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const encrypted = encryptEnvVar(value || '');
    await query(
      `INSERT INTO env_vars (project_id, key, encrypted_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, key) DO UPDATE SET encrypted_value=$3`,
      [req.params.id, key, encrypted]
    );
    res.status(201).json({ key, updated: true });
  } catch (err) {
    console.error('Set env var error:', err);
    res.status(500).json({ error: 'Failed to set env var' });
  }
});

// DELETE /api/projects/:id/env/:key — 删除环境变量
router.delete('/:id/env/:key', jwtAuth, async (req, res) => {
  try {
    const project = await query('SELECT * FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    // 注意：要用 decodeURIComponent 解 URL 编码的 key
    const key = decodeURIComponent(req.params.key);
    await query('DELETE FROM env_vars WHERE project_id=$1 AND key=$2', [req.params.id, key]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete env var error:', err);
    res.status(500).json({ error: 'Failed to delete env var' });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add platform/api-server/src/routes/projects.js
git commit -m "feat: add env var CRUD endpoints"
```

---

### Task 18: 端到端验证

在部署到云主机前，本地验证核心流程。

- [ ] **Step 1: 启动所有服务**

```bash
cd platform
docker compose up -d
```

Expected: 所有 6 个服务（traefik, postgres, redis, api-server, build-runner, deploy-scheduler）启动成功。

- [ ] **Step 2: 验证 API Server 健康检查**

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: 验证数据库表已创建**

```bash
docker compose exec postgres psql -U plat -c "\dt"
```

Expected: 列出 `users`, `projects`, `deploys`, `env_vars` 四张表。

- [ ] **Step 4: 验证 Redis 队列可访问**

```bash
docker compose exec redis redis-cli PING
```

Expected: `PONG`

- [ ] **Step 5: 验证 Traefik Dashboard**

```bash
# Traefik Dashboard 默认在 8080 端口（我们在 compose 中未暴露，可通过内部网络验证）
docker compose exec traefik wget -qO- http://localhost:8080/api/rawdata | head -20
```

Expected: 返回 JSON 数据。

- [ ] **Step 6: Commit**

```bash
git add platform/
git commit -m "test: verify end-to-end infrastructure startup"
```

---

## 部署上线 Checklist

在云主机上首次部署需要额外做的：

1. 将 `.env.example` 复制为 `.env`，填入真实的 GitHub OAuth App 凭据、GitHub App 凭据、加密密钥
2. 配置云厂商 Registry 的访问凭据（`docker login registry.xxx.com`）
3. 注册域名 `platform.com`，将 DNS 泛解析 `*.platform.com` 指向云主机 IP
4. 在 GitHub 上创建 OAuth App（回调 URL: `https://api.platform.com/api/auth/github/callback`）
5. 在 GitHub 上创建 GitHub App（Webhook URL: `https://api.platform.com/api/webhooks/github`）
6. 确保云主机安全组开放 80/443 端口
7. `docker compose up -d`
8. 验证 `https://api.platform.com/health` 返回 OK

---

## 架构原则（本次实现遵循）

1. **每个组件只做一件事** — Build Runner 不部署，Deploy Scheduler 不构建
2. **通过队列解耦** — 服务间不互调 HTTP，全部通过 Redis 队列
3. **零配置优先，自定义兜底** — 自动检测框架，用户 Dockerfile 优先
4. **Docker 路线天然多语言** — 首期 Node.js 检测，架构支持任意语言
5. **不过度设计** — 单机部署，最小化监控
6. **复用而非重复** — CLI 和 GitHub 共享 Build Runner 之后全流程
