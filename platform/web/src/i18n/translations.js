// All user-facing strings for Plat web app
// Key convention: page/component.section.element

const translations = {
  en: {
    // ── Nav / Common ──
    'nav.features': 'Features',
    'nav.how': 'How',
    'nav.login': 'Login',
    'nav.logout': 'Logout',
    'brand.name': 'Plat',

    // ── Landing ──
    'landing.hero.title': 'From vibe coding to live.',
    'landing.hero.subtitle': '让每个创意都能落地',
    'landing.hero.desc': 'Built a cool project? Ship it in one click. No Docker, no Kubernetes, no ops degree — Plat auto-detects your framework, builds a container, and deploys it to your own server with HTTPS.',
    'landing.hero.zh_desc': '创意无需止步于本地。推送代码，即刻上线，无需运维经验。',
    'landing.hero.cta': 'Start Deploying',
    'landing.hero.cta_secondary': 'See how it works →',
    'landing.features.label': '// 01. Capabilities',
    'landing.features.title': "Everything you need, nothing you don't.",
    'landing.features.zh_sub': '化繁为简，回归本质。',
    'landing.features.desc': 'Plat handles the entire deploy pipeline so you can focus on what matters — building cool stuff. No config files, no ops headaches.',

    // Features cards
    'feature.zero_config.title': 'Zero Config',
    'feature.zero_config.zh': '智能识别框架，自动生成 Dockerfile，无需手写配置。',
    'feature.zero_config.desc': 'Push your code. We detect the framework — Next.js, Express, static sites, or custom Dockerfiles — and handle everything.',
    'feature.auto_deploy.title': 'Auto Deploy',
    'feature.auto_deploy.zh': 'Git 推送即触发构建，CLI 一键上传，秒级上线。',
    'feature.auto_deploy.desc': 'GitHub webhooks trigger builds on every push. Or upload via CLI with a single command. Your app goes live in seconds.',
    'feature.auto_ssl.title': 'Auto SSL',
    'feature.auto_ssl.zh': "Let's Encrypt 自动签发证书，HTTPS 零配置。",
    'feature.auto_ssl.desc': "Every deployed app gets a free Let's Encrypt certificate via Traefik. HTTPS by default, zero setup required.",
    'feature.live_logs.title': 'Live Logs',
    'feature.live_logs.zh': '实时 SSE 日志流，构建过程逐行可见。',
    'feature.live_logs.desc': 'Stream build and deploy logs in real-time via SSE. Watch your containers come to life, line by line.',
    'feature.env_vars.title': 'Env Vars',
    'feature.env_vars.zh': 'AES-256-GCM 加密存储，运行时注入容器。',
    'feature.env_vars.desc': 'Manage environment variables per project. AES-256-GCM encrypted at rest, injected at container runtime.',
    'feature.own_stack.title': 'Own Your Stack',
    'feature.own_stack.zh': '部署在你自己的服务器上，数据自主可控。',
    'feature.own_stack.desc': 'Self-hosted on your own 4C8G VPS. No vendor lock-in, no per-seat pricing. Your infra, your rules.',

    // Pipeline
    'landing.pipeline.label': '// 02. Pipeline',
    'landing.pipeline.title': "Push code. That's it.",
    'landing.pipeline.zh_sub': '推送代码，剩下的交给我们。',
    'landing.pipeline.desc': 'Every push triggers a build. Every build becomes a running container. Here\'s the full pipeline — from git push to live app in under 60 seconds.',
    'pipeline.step1.label': 'STEP 01',
    'pipeline.step1.title': 'Connect Repo',
    'pipeline.step1.zh': '关联仓库',
    'pipeline.step2.label': 'STEP 02',
    'pipeline.step2.title': 'Git Push',
    'pipeline.step2.zh': '推送代码',
    'pipeline.step3.label': 'STEP 03',
    'pipeline.step3.title': 'Auto Build',
    'pipeline.step3.zh': '自动构建',
    'pipeline.step4.label': 'STEP 04',
    'pipeline.step4.title': 'Deploy',
    'pipeline.step4.zh': '部署上线',
    'pipeline.step5.label': 'STEP 05',
    'pipeline.step5.title': 'Live',
    'pipeline.step5.zh': '即刻运行',

    // Frameworks
    'landing.frameworks.label': '> Supported frameworks (auto-detected)',

    // CTA
    'landing.cta.title': 'Ready to ship?',
    'landing.cta.zh_sub': '准备好启程了吗？',
    'landing.cta.desc': 'One server. Unlimited projects. Zero configuration.\nDeploy your vibe. Own your infrastructure.',
    'landing.cta.zh_desc': '一台服务器，无限项目，零配置。\n部署你的创意，掌控你的基础设施。',
    'landing.cta.btn': 'Login with GitHub',

    // Footer
    'landing.footer': 'Plat v0.1.0 — Self-hosted deploy platform. From vibe coding to live.',
    'footer.features': 'Features',
    'footer.how': 'How it works',
    'footer.login': 'Login',

    // ── Login ──
    'login.subtitle': 'Deploy your code in seconds.\nZero config. One command.',
    'login.connecting': 'Connecting...',
    'login.github_btn': 'Login with GitHub',
    'login.google_btn': 'Login with Google',
    'login.providers_title': 'Choose a login method',
    'login.footer': 'v0.1.0 — Alpha',

    // ── Dashboard ──
    'dashboard.heading': 'Projects',
    'dashboard.new_btn': '+ New',
    'dashboard.repo_placeholder': '> https://github.com/user/repo.git',
    'dashboard.deploy_btn': 'Deploy',
    'dashboard.creating': '...',
    'dashboard.loading': 'Loading...',
    'dashboard.empty_title': 'No projects',
    'dashboard.empty_desc': 'Create your first project to start deploying.\nConnect a GitHub repo or use the CLI.',
    'dashboard.confirm_text': 'Delete "{name}"? This will stop the running app and remove all data.',
    'dashboard.confirm_delete': 'Delete',
    'dashboard.confirm_cancel': 'Cancel',

    // ── Project Detail ──
    'project.back': '← Back',
    'project.loading': 'Loading...',
    'project.not_found': 'Project not found',
    'project.meta_domain': 'Domain',
    'project.meta_framework': 'Framework',
    'project.meta_source': 'Source',
    'project.framework_auto': 'auto',
    'project.deploy_queued': 'Deploy queued',
    'project.history': 'History',
    'project.history_empty': 'No deploy history yet. Click Deploy above to start.',
    'project.commit_manual': 'manual',
    'project.environment': 'Environment',
    'project.danger_zone': 'Danger Zone',
    'project.danger_desc': 'Deleting this project will stop the running app and permanently remove all deploy history, environment variables, and logs. This action cannot be undone.',
    'project.delete_btn': 'Delete Project',
    'project.confirm_text': 'Are you sure? This cannot be undone.',
    'project.deleting': 'Deleting...',
    'project.confirm_yes': 'Yes, Delete',
    'project.confirm_cancel': 'Cancel',

    // ── Deploy Status ──
    'status.pending': 'pending',
    'status.building': 'building',
    'status.deploying': 'deploying',
    'status.running': 'running',
    'status.failed': 'failed',

    // ── Deploy Button ──
    'deploy.deploying': 'Deploying...',
    'deploy.in_progress': 'In progress',
    'deploy.deploy': 'Deploy',

    // ── Deploy Log ──
    'log.title': 'Deploy Log',
    'log.connecting': 'Connecting to build stream...',
    'log.waiting': 'Waiting for build output...',
    'log.success': '✓ Deploy successful',
    'log.failed': '✗ Deploy failed',
    'log.disconnected': '✗ Stream disconnected',

    // ── Env Var Form ──
    'env.loading': 'Loading...',
    'env.empty': 'No environment variables configured',
    'env.del_btn': 'Del',
    'env.key_placeholder': 'KEY',
    'env.value_placeholder': 'VALUE',
    'env.add_btn': 'Add',
    'env.adding': '...',
  },

  zh: {
    // ── Nav / Common ──
    'nav.features': '功能',
    'nav.how': '流程',
    'nav.login': '登录',
    'nav.logout': '退出',
    'brand.name': 'Plat',

    // ── Landing ──
    'landing.hero.title': '灵感落地，一键上线。',
    'landing.hero.subtitle': '让每个创意都能落地',
    'landing.hero.desc': '写了好玩的项目？一键上线。不需要 Docker、Kubernetes 或运维经验——Plat 自动识别框架、构建容器，部署到你自己的服务器上，自带 HTTPS。',
    'landing.hero.zh_desc': '创意无需止步于本地。推送代码，即刻上线，无需运维经验。',
    'landing.hero.cta': '开始部署',
    'landing.hero.cta_secondary': '了解如何工作 →',
    'landing.features.label': '// 01. 功能特性',
    'landing.features.title': '化繁为简，回归本质。',
    'landing.features.zh_sub': '化繁为简，回归本质。',
    'landing.features.desc': 'Plat 负责整个部署流水线，让你专注于创造。无需配置文件，无需操心基础设施。',

    // Features cards
    'feature.zero_config.title': '零配置',
    'feature.zero_config.zh': '智能识别框架，自动生成 Dockerfile，无需手写配置。',
    'feature.zero_config.desc': '推送代码即可，我们会检测框架——Next.js、Express、静态站点或自定义 Dockerfile——然后处理剩下的一切。',
    'feature.auto_deploy.title': '自动部署',
    'feature.auto_deploy.zh': 'Git 推送即触发构建，CLI 一键上传，秒级上线。',
    'feature.auto_deploy.desc': '每次推送 GitHub webhook 都会触发构建。也可以通过 CLI 单条命令上传。你的应用数秒内即可上线。',
    'feature.auto_ssl.title': '自动 SSL',
    'feature.auto_ssl.zh': "Let's Encrypt 自动签发证书，HTTPS 零配置。",
    'feature.auto_ssl.desc': "每个部署的应用都通过 Traefik 获取免费的 Let's Encrypt 证书。默认 HTTPS，无需任何设置。",
    'feature.live_logs.title': '实时日志',
    'feature.live_logs.zh': '实时 SSE 日志流，构建过程逐行可见。',
    'feature.live_logs.desc': '通过 SSE 实时流式传输构建和部署日志。逐行观察你的容器诞生。',
    'feature.env_vars.title': '环境变量',
    'feature.env_vars.zh': 'AES-256-GCM 加密存储，运行时注入容器。',
    'feature.env_vars.desc': '为每个项目管理环境变量。使用 AES-256-GCM 加密存储，在容器运行时注入。',
    'feature.own_stack.title': '自主可控',
    'feature.own_stack.zh': '部署在你自己的服务器上，数据自主可控。',
    'feature.own_stack.desc': '托管在你自己的 4C8G VPS 上。无供应商锁定，无按人头定价。你的基础设施，你的规则。',

    // Pipeline
    'landing.pipeline.label': '// 02. 部署流水线',
    'landing.pipeline.title': '推送代码，就这么简单。',
    'landing.pipeline.zh_sub': '推送代码，剩下的交给我们。',
    'landing.pipeline.desc': '每次推送触发构建。每次构建成为一个运行中的容器。以下是完整的流水线——从 git push 到应用上线，不到 60 秒。',
    'pipeline.step1.label': '步骤 01',
    'pipeline.step1.title': '连接仓库',
    'pipeline.step1.zh': '关联仓库',
    'pipeline.step2.label': '步骤 02',
    'pipeline.step2.title': '推送代码',
    'pipeline.step2.zh': '推送代码',
    'pipeline.step3.label': '步骤 03',
    'pipeline.step3.title': '自动构建',
    'pipeline.step3.zh': '自动构建',
    'pipeline.step4.label': '步骤 04',
    'pipeline.step4.title': '部署上线',
    'pipeline.step4.zh': '部署上线',
    'pipeline.step5.label': '步骤 05',
    'pipeline.step5.title': '即刻运行',
    'pipeline.step5.zh': '即刻运行',

    // Frameworks
    'landing.frameworks.label': '> 支持的框架（自动检测）',

    // CTA
    'landing.cta.title': '准备好启程了吗？',
    'landing.cta.zh_sub': '准备好启程了吗？',
    'landing.cta.desc': '一台服务器，无限项目，零配置。',
    'landing.cta.zh_desc': '一台服务器，无限项目，零配置。\n部署你的创意，掌控你的基础设施。',
    'landing.cta.btn': '使用 GitHub 登录',

    // Footer
    'landing.footer': 'Plat v0.1.0 — 自托管部署平台，从灵感落地到线上运行。',
    'footer.features': '功能',
    'footer.how': '工作流程',
    'footer.login': '登录',

    // ── Login ──
    'login.subtitle': '秒级部署代码。\n零配置，一条命令。',
    'login.connecting': '连接中...',
    'login.github_btn': '使用 GitHub 登录',
    'login.google_btn': '使用 Google 登录',
    'login.providers_title': '选择登录方式',
    'login.footer': 'v0.1.0 — Alpha',

    // ── Dashboard ──
    'dashboard.heading': '项目列表',
    'dashboard.new_btn': '+ 新建',
    'dashboard.repo_placeholder': '> https://github.com/user/repo.git',
    'dashboard.deploy_btn': '部署',
    'dashboard.creating': '...',
    'dashboard.loading': '加载中...',
    'dashboard.empty_title': '暂无项目',
    'dashboard.empty_desc': '创建你的第一个项目开始部署。\n关联 GitHub 仓库或使用 CLI 上传。',
    'dashboard.confirm_text': '删除 "{name}"？这将停止正在运行的应用并移除所有数据。',
    'dashboard.confirm_delete': '删除',
    'dashboard.confirm_cancel': '取消',

    // ── Project Detail ──
    'project.back': '← 返回',
    'project.loading': '加载中...',
    'project.not_found': '项目未找到',
    'project.meta_domain': '域名',
    'project.meta_framework': '框架',
    'project.meta_source': '来源',
    'project.framework_auto': '自动',
    'project.deploy_queued': '部署已加入队列',
    'project.history': '历史记录',
    'project.history_empty': '暂无部署历史。点击上方部署按钮开始。',
    'project.commit_manual': '手动',
    'project.environment': '环境变量',
    'project.danger_zone': '危险区域',
    'project.danger_desc': '删除此项目将停止正在运行的应用并永久移除所有部署历史、环境变量和日志。此操作不可撤销。',
    'project.delete_btn': '删除项目',
    'project.confirm_text': '确定要删除吗？此操作不可撤销。',
    'project.deleting': '删除中...',
    'project.confirm_yes': '确认删除',
    'project.confirm_cancel': '取消',

    // ── Deploy Status ──
    'status.pending': '等待中',
    'status.building': '构建中',
    'status.deploying': '部署中',
    'status.running': '运行中',
    'status.failed': '失败',

    // ── Deploy Button ──
    'deploy.deploying': '部署中...',
    'deploy.in_progress': '进行中',
    'deploy.deploy': '部署',

    // ── Deploy Log ──
    'log.title': '部署日志',
    'log.connecting': '正在连接构建流...',
    'log.waiting': '等待构建输出...',
    'log.success': '✓ 部署成功',
    'log.failed': '✗ 部署失败',
    'log.disconnected': '✗ 流已断开',

    // ── Env Var Form ──
    'env.loading': '加载中...',
    'env.empty': '未配置环境变量',
    'env.del_btn': '删除',
    'env.key_placeholder': '变量名',
    'env.value_placeholder': '变量值',
    'env.add_btn': '添加',
    'env.adding': '...',
  },
};

export default translations;
