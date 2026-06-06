# 轻量化自动部署平台 — 设计文档

> 2026-06-06 | 目标：面向 vibe coding 用户的类 Vercel 自动部署平台

## 一、愿景与范围

### 要解决的问题

越来越多用户使用 AI 编程工具（Cursor、Claude、GPT、Codex）快速产出全栈应用代码，但普遍卡在最后一步：**不会部署上线**。

### 目标用户

- 用 AI 工具快速产出代码的 vibe coder
- 可能用 GitHub，也可能代码只在本地
- 技术能力：能写代码，不熟悉运维/DevOps

### 首期范围（MVP）

- 公有云单机部署，小规模验证（几十用户、几百部署）
- 首期 Node.js 生态自动检测优先，架构基于 Docker 路线天然支持多语言
- GitHub 用户 + CLI 用户（本地代码上传）双入口
- 私有 Docker Registry 使用云厂商服务

### 不做的事（明确排除）

- 不出现在这个设计里的功能（数据库托管、定时任务、团队协作、用量计费、多区域部署）均不在首期范围内

---

## 二、整体架构

### 架构图

```
                          ┌──────────────────────────┐
                          │       GitHub Webhook      │
                          └────────────┬─────────────┘
                                       │
                                       ▼
┌──────────────┐    HTTP     ┌─────────────────┐
│   用户 Web UI │ ◄────────► │   API Server    │
│  (React SPA) │            │  (Node.js/Go)   │
└──────────────┘            └───┬───────┬─────┘
                                │       │
                         提交任务 │       │ 查询状态 / 读日志
                                │       │
                    ┌───────────▼─┐  ┌──▼───────────┐
                    │    Redis    │  │  PostgreSQL   │
                    │  (任务队列)  │  │ (元数据存储)   │
                    └────┬───┬────┘  └──────────────┘
                         │   │
              ┌──────────▼─┐ ┌▼──────────────┐
              │Build Runner│ │Deploy Scheduler│
              │ (构建容器)  │ │  (部署容器)    │
              └──────┬─────┘ └───────┬────────┘
                     │               │
                     ▼               ▼
              ┌─────────────┐ ┌──────────────┐
              │ 云厂商私有   │ │   Docker     │
              │  Registry   │ │   Engine     │
              └─────────────┘ └──────┬───────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │    Traefik      │
                            │ (路由 + SSL)    │
                            └─────────────────┘
```

### 服务职责

| 服务 | 职责 | 关键依赖 |
|------|------|---------|
| **API Server** | 用户认证、项目管理、触发构建、查询状态、推送日志 | PostgreSQL, Redis |
| **Build Runner** | 从 Redis 取任务 → git clone / 解压 tar → 检测框架 → docker build → push 到 Registry → 投递部署任务 | Redis, 云 Registry |
| **Deploy Scheduler** | 从 Redis 取任务 → docker pull → 停止旧容器 → docker run（带 Traefik labels + 环境变量 + 资源限制） | Redis, Docker Engine |
| **Traefik** | 监听 Docker Engine 容器事件，自动生成路由和 Let's Encrypt SSL 证书 | Docker Engine, Let's Encrypt |

### 基础设施

| 组件 | 用途 |
|------|------|
| **PostgreSQL** | 用户、项目、部署记录、环境变量（加密存储）、域名映射 |
| **Redis** | 构建任务队列（`build:queue`）、部署任务队列（`deploy:queue`）、构建日志缓冲（`build:log:<deployId>`） |

### 部署拓扑（首期单机）

所有服务通过 `docker compose` 跑在一台 4C8G 云主机上：

```
docker compose up
├── postgres:16-alpine
├── redis:7-alpine
├── api-server
├── build-runner
├── deploy-scheduler
├── traefik:v3
└── 用户容器们（动态 docker run）
```

---

## 三、源码传输与产物流转

### 数据流三阶段

```
用户 GitHub ──git clone──► Build Runner ──docker push──► 云厂商 Registry ──docker pull──► Docker Engine
   (源码)                  (构建镜像)                    (镜像存储)                    (运行容器)
```

### 阶段 1：源码获取

- **GitHub 用户**：Build Runner 直接 `git clone https://github.com/user/repo.git`
- **CLI 用户**：CLI 工具 tar 打包本地项目（排除 `node_modules`、`.git`、`.next` 等），上传到 API Server，Build Runner 取到任务后解压

### 阶段 2：镜像构建与推送

Build Runner 完成 `docker build` 后，将镜像推送到云厂商私有 Registry（如阿里云 ACR）。

### 阶段 3：镜像拉取与运行

Deploy Scheduler 从云厂商 Registry `docker pull` 镜像，在本机 Docker Engine 上运行。

### Build Runner 任务生命周期

```
循环:
1. BLPOP build:queue              ← 等待构建任务
2. git clone 或 解压 tar.gz        ← 获取源码
3. 检测框架 → 生成 Dockerfile      ← 零配置构建
4. docker build → docker push      ← 构建并推送到云 Registry
5. RPUSH deploy:queue {任务JSON}   ← 投递部署任务到 Redis
6. 清理临时目录                     ← /tmp/builds/<build-id>
7. 回到步骤 1
```

---

## 四、零配置构建（框架自动检测）

### 检测策略：级联探测

按优先级依次检查项目中的特征文件：

| 优先级 | 检测特征 | 判定框架 | 生成策略 |
|--------|---------|---------|---------|
| 1 | 用户自带了 `Dockerfile` | 自定义 | 原样使用，跳过自动生成 |
| 2 | `package.json` 中有 `"next":` | Next.js | `node:20-alpine`，`next build && next start`，端口 3000 |
| 3 | `package.json` 中有 `"nuxt":` | Nuxt | `node:20-alpine`，`nuxt build`，端口 3000 |
| 4 | `package.json` 中有 `"@sveltejs/kit":` | SvelteKit | 对应构建命令，端口 3000 |
| 5 | `package.json` 中有 `"express":` | Express | `npm install --production`，端口根据代码推断 |
| 6 | `package.json` 中有 `"start"` 脚本 | 通用 Node | `npm install && npm start` |
| 7 | `package.json` 存在 | 兜底 Node | `npm install && node index.js` |
| 8 | 以上都不匹配 | 静态站点 | `nginx:alpine`，serve `dist/` 或 `public/` |

### 生成产物

每类框架一个 Dockerfile 模板，自动生成时同时产出 `.dockerignore`（排除 `node_modules`、`.git` 等）。

### 扩展机制

首期只实现 Node.js 生态的检测逻辑（1-8），但每个语言的检测器设计为独立模块：

```
detectors/
  node.js      ← 首期实现
  python.js    ← 后续
  go.js        ← 后续
  static.js    ← 首期实现（兜底）
```

后续加新语言就是写一个检测函数 + 一个 Dockerfile 模板，不碰核心构建流程。

---

## 五、部署调度与路由

### 部署流程

```
Build Runner 投递部署任务到 Redis
        │
        ▼
Deploy Scheduler BLPOP deploy:queue
        │
        ▼
docker pull registry.xxx.com/user/project:<tag>
        │
        ▼
停止旧容器（如果存在: docker stop + docker rm）
        │
        ▼
docker run -d \
  --memory=512m --cpus=0.5 \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.<id>.rule=Host(\`project.user.platform.com\`)" \
  --label "traefik.http.services.<id>.loadbalancer.server.port=3000" \
  --env KEY=VALUE \
  registry.xxx.com/user/project:<tag>
        │
        ▼
Traefik Docker Provider 自动发现新容器 → 更新路由表 → 签发 SSL
        │
        ▼
用户可通过 https://project.user.platform.com 访问
```

### Traefik 核心配置（一次配置，运行后不改）

```yaml
providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@platform.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

### 容器隔离

每次 `docker run` 强制带上资源限制：

```
--memory=512m --cpus=0.5 --memory-swap=512m
```

不同套餐可以给不同的限制值（后续扩展）。

### 端口处理

检测框架时记录目标端口（Next.js:3000, Express:3000, FastAPI:8000），写入部署任务。Deploy Scheduler 将此端口注入 Traefik Label。

---

## 六、Redis 队列设计

### 为什么用 Redis 做队列

Build Runner 和 Deploy Scheduler 之间通过 Redis 解耦：
- Build Runner 构建完投递任务就走，不需要知道 Deploy Scheduler 在哪
- Deploy Scheduler 串行处理任务，天然避免并发容器操作的竞态问题
- Deploy Scheduler 挂了重启，队列里的任务不丢
- `LLEN` 即可观测排队情况

### 队列结构

```
build:queue          ← 构建任务队列（API Server RPUSH, Build Runner BLPOP）
deploy:queue         ← 部署任务队列（Build Runner RPUSH, Deploy Scheduler BLPOP）
build:log:<deployId> ← 单次构建的日志行（Build Runner RPUSH, API Server BLPOP）
```

### 命令一览

| 操作 | 命令 |
|------|------|
| 投递构建任务 | `RPUSH build:queue <task-json>` |
| 取构建任务（阻塞） | `BLPOP build:queue 0` |
| 投递部署任务 | `RPUSH deploy:queue <task-json>` |
| 取部署任务（阻塞） | `BLPOP deploy:queue 0` |
| 写构建日志 | `RPUSH build:log:<deployId> <line>` |
| 读构建日志（非阻塞） | `BLPOP build:log:<deployId> 1` |

---

## 七、GitHub 集成

### 7.1 两种凭证的区别

| | GitHub OAuth App | GitHub App |
|------|-----------------|------------|
| **代表谁** | 代表**用户本人** | 代表**平台** |
| **用途** | 用户登录认证 | 操作仓库（安装 Webhook、读代码） |
| **产物** | 用户 access_token → JWT | Installation token → API 操作权限 |

### 7.2 用户登录流程（OAuth App）

```
1. 用户点击 "Login with GitHub"
2. 跳转 GitHub 授权页
3. 用户授权 → GitHub 回调 API Server (/api/auth/github/callback)
4. API Server 拿 authorization_code 换 access_token
5. 用 access_token 获取用户 GitHub 信息
6. 创建/查找本地用户记录 → 签发 JWT → 浏览器存 cookie
```

### 7.3 仓库连接流程（GitHub App）

```
1. 用户登录后在平台选仓库
2. 平台用 GitHub App 身份请求安装到用户仓库
3. 用户跳转 GitHub 授权："PlatDeploy 平台想要访问你的仓库，同意吗？"
4. 用户同意 → GitHub 自动在仓库创建 Webhook（监听 push 事件）
5. Webhook payload URL = https://api.platform.com/webhooks/github
```

### 7.4 Webhook 处理

```
GitHub POST webhook:
  → API Server 验证 HMAC-SHA256 签名
  → 提取: repo_url, branch, commit_sha, 用户身份
  → 创建 deploy 记录（status: pending）
  → RPUSH build:queue { deployId, repoUrl, branch, commitSha }
  → 返回 200 给 GitHub
```

---

## 八、CLI 双入口（兼顾无 Git 用户）

### 设计动机

部分 vibe coder 代码在本地，不使用 GitHub。提供 CLI 工具覆盖这类用户。

### CLI 工作流程

```
$ npm i -g plat-cli
$ plat login               ← 浏览器打开平台登录页，OAuth 认证，拿到 API Key
$ cd my-project
$ plat deploy

CLI 做的事情:
1. 自动检测框架（与 Build Runner 同一套检测逻辑）
2. tar 打包项目（排除 node_modules、.git、.next 等）
3. POST /api/cli/deploy（multipart upload）
4. 轮询 /api/cli/deploy/:id → 终端实时打印日志
5. 部署完成 → 打印域名
```

### 新增 API 端点

```
POST /api/cli/login       ← 用 API Key 登录（返回 token）
POST /api/cli/deploy      ← multipart 上传 tar 包
GET  /api/cli/deploy/:id  ← 轮询部署状态 + 日志
```

### 复用关系

CLI 上传的 tar 包到了 Build Runner 后，解压 → 检测框架 → docker build → docker push → deploy，与 GitHub 路线完全一致，不新增后端模块。

---

## 九、API 设计

### 用户端 API（需 JWT 认证）

```
GET    /api/auth/github/callback    ← GitHub OAuth 回调（无认证）
GET    /api/projects                ← 我的项目列表
POST   /api/projects                ← 创建项目（关联 GitHub 仓库 或 CLI 项目）
GET    /api/projects/:id            ← 项目详情 + 部署历史
POST   /api/projects/:id/deploy     ← 手动触发部署
GET    /api/deploys/:id             ← 查询部署状态
GET    /api/deploys/:id/logs        ← SSE 实时日志流（仅 CLI 路线）
```

### CLI 端 API（需 API Key）

```
POST   /api/cli/login              ← 用 API Key 登录
POST   /api/cli/deploy             ← 上传 tar 包
GET    /api/cli/deploy/:id         ← 轮询状态 + 日志
```

### Webhook 入口（无用户认证，HMAC 签名验证）

```
POST   /api/webhooks/github        ← GitHub Webhook
```

### 数据库核心表

```sql
users (
    id, github_id, username, email, avatar_url, api_key, created_at
)

projects (
    id, user_id, repo_url, repo_name, framework, target_port,
    domain, created_at
)
-- domain: <repo-name>.<username>.platform.com，首次部署时自动生成

deploys (
    id, project_id, commit_sha, status, image_tag,
    log_text, created_at, finished_at
)
-- status: pending → building → deploying → running
--                          ↘ failed    ↘ failed

env_vars (
    id, project_id, key, encrypted_value, created_at
)
-- value 用 AES-256-GCM 加密存储，平台主密钥配在服务器环境变量
```

---

## 十、域名与 SSL

### 10.1 平台自动分配域名

```
格式:  <repo-name>.<username>.platform.com

示例:  my-todo-app.alice.platform.com
```

### 10.2 自动 SSL

Traefik 集成 Let's Encrypt：新容器出现 → Traefik 检测新 Host 规则 → 自动发起 ACME HTTP-01 挑战 → 签发证书。证书到期前自动续签，平台代码零参与。

### 10.3 用户自定义域名（后续阶段）

```
1. 用户在设置页填自定义域名
2. 平台返回需要添加的 CNAME 记录
3. 用户去 DNS 服务商添加记录
4. 平台验证 DNS 传播后更新域名映射
5. Traefik 自动检测并签发 SSL
```

---

## 十一、部署日志与状态推送

### 11.1 部署状态

```
pending → building → deploying → running
              ↘              ↘
             failed          failed
```

### 11.2 实时日志（SSE）

```
日志流向:
  Build Runner docker build 输出 ──► RPUSH build:log:<deployId> <line>
                                           │
  API Server GET /api/deploys/:id/logs ──► BLPOP build:log:<deployId>
                                           │
                                      SSE write ──► 前端实时展示
```

用户在 Web 界面看到类似终端输出的实时滚动日志。

---

## 十二、环境变量管理

### 12.1 用户配置

项目设置页提供 key-value 表单，支持添加/删除/编辑环境变量。

### 12.2 注入方式

Deploy Scheduler 在 `docker run` 时通过 `--env KEY=VALUE` 注入。修改环境变量后，只有下一次部署才会生效（不自动重启现有容器）。

### 12.3 安全存储

- 数据库存加密后的密文（AES-256-GCM）
- 平台主密钥（`ENCRYPTION_KEY`）配在服务器环境变量中，不写代码，不提交 Git
- `docker run` 时从 DB 读密文 → 解密 → `--env KEY=plaintext`

### 12.4 平台默认注入

```
PLATFORM_APP_URL=https://myapp.alice.platform.com
PORT=3000
```

---

## 十三、Docker 构建缓存

### 13.1 缓存策略

使用 Docker BuildKit + Registry Cache：

```bash
docker buildx build \
  --cache-from type=registry,ref=registry.xxx.com/user/project:cache \
  --cache-to   type=registry,ref=registry.xxx.com/user/project:cache,mode=max \
  -t registry.xxx.com/user/project:<tag> \
  --push .
```

### 13.2 Dockerfile 层优化

生成的 Dockerfile 把不容易变的内容放上层：

```dockerfile
FROM node:20-alpine
WORKDIR /app

# 第一层：package.json 很少变 → 缓存命中率高
COPY package.json package-lock.json* ./
RUN npm install

# 第二层：源码经常变，但前面 layer 能复用
COPY . .
RUN npm run build

CMD ["npm", "start"]
```

### 13.3 缓存淘汰

每个项目只保留最新一个 cache tag（强制覆盖），不堆积。

---

## 十四、监控与容错（最小化）

### 14.1 服务健康检查

`docker compose` 内置 healthcheck + `restart: unless-stopped`，挂了自动拉起。

### 14.2 任务失败处理

- 构建失败：记录日志 → 标记 status: failed → 不重试（代码层面的错误重试也没用）
- 网络瞬断：Build Runner 内部重试 3 次 → 仍失败则标记 failed
- Build Runner 进程崩溃：docker 自动重启，重新 BLPOP 队列中的下一个任务

初期接受少量任务丢失是合理的工程取舍，后续量大了再加重试和幂等保证。

### 14.3 资源监控

SSH 进机器看 `docker stats` / `htop`，不做完备的可观测性建设。

---

## 十五、技术选型总结

| 组件 | 选型 | 说明 |
|------|------|------|
| 云平台 | 公有云（具体待定） | 4C8G 单机起步 |
| 容器镜像仓库 | 云厂商私有 Registry | 如阿里云 ACR |
| 容器运行时 | Docker Engine | `docker compose` 编排平台自身服务 |
| 反向代理 + SSL | Traefik v3 | Docker Provider 动态路由 + Let's Encrypt |
| 数据库 | PostgreSQL 16 | 结构化元数据 |
| 消息队列 / 缓存 | Redis 7 | 构建/部署任务队列 + 日志缓冲 |
| 构建方式 | Docker + BuildKit | `docker buildx build --cache-from registry` |
| API Server 语言 | 待定（Node.js 或 Go） | 与目标用户技术栈一致的推荐 Node.js |
| 前端 | React SPA | 轻量管理后台 |
| CLI 工具 | Node.js CLI | `npm i -g plat-cli` |

---

## 十六、架构设计原则总结

1. **每个组件只做一件事**：Build Runner 不会部署，Deploy Scheduler 不会构建
2. **通过队列解耦**：服务之间不互相 HTTP 调用，通过 Redis 队列通信
3. **零配置优先，自定义兜底**：自动检测框架 → 生成 Dockerfile；用户有 `Dockerfile` 则优先使用
4. **Docker 路线天然多语言**：首期只做 Node.js 检测逻辑，但架构已支持任意语言
5. **初期不过度设计**：单机部署，最小化监控，接受少量任务丢失
6. **复用而非重复**：CLI 和 GitHub 两条路线共享 Build Runner 之后的所有流程
