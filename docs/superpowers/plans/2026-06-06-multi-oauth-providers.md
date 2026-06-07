# Multi-Provider OAuth Authentication — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth login while refactoring to a generic multi-provider OAuth architecture using a `user_identities` table.

**Architecture:** Refactor OAuth into a provider-pattern service (`services/oauth/`) with parameterized routes (`/api/auth/:provider`). Decouple identities from users via a new `user_identities` table allowing multiple login methods per user, auto-merged by email. Frontend login page gains a provider selector.

**Tech Stack:** Node.js (Express), PostgreSQL, React (Vite), jsonwebtoken, Google OAuth 2.0 (Authorization Code Flow)

---

### Task 1: Database Schema — Versioned Migration System + `user_identities`

**Files:**
- Modify: `platform/api-server/src/db.js`

- [ ] **Step 1: Add `schema_migrations` table and versioned migration runner**

Replace the entire content of `platform/api-server/src/db.js` with the following:

```js
import pg from 'pg';
import { config } from './config.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
});

// ── Base schema (version 0) ──────────────────────────────────────────
// This is the always-idempotent foundation. New tables added here use
// IF NOT EXISTS so initDb is safe to run repeatedly on fresh DBs.
const BASE_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    avatar_url TEXT,
    api_key VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_identities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    profile_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user_id ON user_identities(user_id);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    repo_url TEXT,
    repo_name VARCHAR(255) NOT NULL,
    source_type VARCHAR(20) NOT NULL DEFAULT 'github',
    framework VARCHAR(50),
    target_port INTEGER DEFAULT 3000,
    domain VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deploys (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    commit_sha VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
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

// ── Migration definitions ────────────────────────────────────────────
// Each migration has a version number, description, and SQL.
// Migrations are applied in version order exactly once.
// The SQL MUST be idempotent (guard with IF EXISTS / IF NOT EXISTS).

const MIGRATIONS = [
  {
    version: 1,
    description: 'migrate github_id from users to user_identities, then drop column',
    sql: `
      -- If users table still has github_id column (pre-migration DB),
      -- move data to user_identities and drop the column.
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'github_id'
        ) THEN
          INSERT INTO user_identities (user_id, provider, provider_user_id, provider_email, profile_data)
          SELECT id, 'github', github_id::VARCHAR, email, '{}'::jsonb
          FROM users WHERE github_id IS NOT NULL
          ON CONFLICT (provider, provider_user_id) DO NOTHING;

          ALTER TABLE users DROP COLUMN github_id;
        END IF;
      END $$;
    `,
  },
  // Future migrations go here, e.g.:
  // { version: 2, description: 'add refresh_token column to user_identities', sql: `...` },
];

// ── Migration runner ─────────────────────────────────────────────────

async function getCurrentVersion(client) {
  const res = await client.query('SELECT MAX(version) as v FROM schema_migrations');
  return res.rows[0]?.v || 0;
}

async function applyMigrations(client) {
  const currentVersion = await getCurrentVersion(client);

  const pending = MIGRATIONS
    .filter(m => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    console.log(`DB schema is up to date (version ${currentVersion})`);
    return;
  }

  console.log(`Running ${pending.length} pending migration(s) (current version: ${currentVersion})...`);

  for (const m of pending) {
    console.log(`  Migration v${m.version}: ${m.description}...`);
    await client.query('BEGIN');
    try {
      await client.query(m.sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [m.version]);
      await client.query('COMMIT');
      console.log(`  Migration v${m.version}: ✓ applied`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  Migration v${m.version}: ✗ FAILED — ${err.message}`);
      throw err;
    }
  }

  console.log(`All migrations applied. DB now at version ${pending[pending.length - 1].version}`);
}

// ── Init ─────────────────────────────────────────────────────────────

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(BASE_SCHEMA_SQL);
    await applyMigrations(client);
    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}

// ── Public API ───────────────────────────────────────────────────────

export function query(text, params) {
  return pool.query(text, params);
}

export function getClient() {
  return pool.connect();
}
```

- [ ] **Step 2: Commit**

```bash
git add platform/api-server/src/db.js
git commit -m "feat(db): add versioned migration system and user_identities table"
```

---

### Task 2: OAuth Provider Configs — GitHub and Google

**Files:**
- Create: `platform/api-server/src/services/oauth/providers/github.js`
- Create: `platform/api-server/src/services/oauth/providers/google.js`
- Modify: `platform/api-server/src/config.js`

- [ ] **Step 1: Add Google OAuth config to config.js**

In `platform/api-server/src/config.js`, add a `google` block inside the config object, right after the `github` block:

```js
google: {
  oauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  oauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
},
```

The resulting config object should have both:

```js
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
  google: {
    oauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    oauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  },
  registry: {
    url: process.env.REGISTRY_URL || 'registry.local',
    namespace: process.env.REGISTRY_NAMESPACE || 'plat',
  },
  platformDomain: process.env.PLATFORM_DOMAIN || 'platform.local',
};
```

- [ ] **Step 2: Create GitHub OAuth provider**

Create `platform/api-server/src/services/oauth/providers/github.js`:

```js
import { config } from '../../../config.js';

export const githubProvider = {
  id: 'github',
  name: 'GitHub',
  authEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  userInfoEndpoint: 'https://api.github.com/user',

  clientId: () => config.github.oauthClientId,
  clientSecret: () => config.github.oauthClientSecret,

  scopes: ['user:email'],

  async exchangeCode(code, redirectUri) {
    const res = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId(),
        client_secret: this.clientSecret(),
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) throw new Error(`GitHub OAuth token exchange failed: ${res.status}`);
    const data = await res.json();
    return data.access_token;
  },

  async getUser(accessToken) {
    const res = await fetch(this.userInfoEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`GitHub user fetch failed: ${res.status}`);
    const profile = await res.json();
    return {
      providerUserId: String(profile.id),
      email: profile.email || null,
      username: profile.login,
      avatarUrl: profile.avatar_url,
      profileData: profile,
    };
  },
};
```

- [ ] **Step 3: Create Google OAuth provider**

Create `platform/api-server/src/services/oauth/providers/google.js`:

```js
import { config } from '../../../config.js';

export const googleProvider = {
  id: 'google',
  name: 'Google',
  authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',

  clientId: () => config.google.oauthClientId,
  clientSecret: () => config.google.oauthClientSecret,

  scopes: ['openid', 'email', 'profile'],

  async exchangeCode(code, redirectUri) {
    const res = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId(),
        client_secret: this.clientSecret(),
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new Error(`Google OAuth token exchange failed: ${res.status}`);
    const data = await res.json();
    return data.access_token;
  },

  async getUser(accessToken) {
    const res = await fetch(`${this.userInfoEndpoint}?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) throw new Error(`Google user fetch failed: ${res.status}`);
    const profile = await res.json();
    return {
      providerUserId: String(profile.id),
      email: profile.email || null,
      username: profile.name || profile.email?.split('@')[0] || 'google-user',
      avatarUrl: profile.picture || null,
      profileData: profile,
    };
  },
};
```

- [ ] **Step 4: Create provider registry**

Create `platform/api-server/src/services/oauth/providers/index.js`:

```js
import { githubProvider } from './github.js';
import { googleProvider } from './google.js';

const providers = [githubProvider, googleProvider];

export function getProvider(id) {
  const provider = providers.find(p => p.id === id);
  if (!provider) throw new Error(`Unknown OAuth provider: ${id}`);
  return provider;
}

export function getEnabledProviders() {
  return providers.filter(p => p.clientId() && p.clientSecret());
}

export { githubProvider, googleProvider };
```

- [ ] **Step 5: Commit**

```bash
git add platform/api-server/src/config.js \
        platform/api-server/src/services/oauth/
git commit -m "feat(oauth): add Google provider config and OAuth provider definitions"
```

---

### Task 3: Generic OAuth Handler Service

**Files:**
- Create: `platform/api-server/src/services/oauth/index.js`

- [ ] **Step 1: Create the generic OAuth service**

Create `platform/api-server/src/services/oauth/index.js`:

```js
import { query } from '../../db.js';
import { signToken } from '../../middleware/jwtAuth.js';
import { getProvider, getEnabledProviders } from './providers/index.js';

/**
 * Build the OAuth authorization URL for a given provider.
 */
export function getAuthorizationUrl(providerId, redirectUri) {
  const p = getProvider(providerId);
  const params = new URLSearchParams({
    client_id: p.clientId(),
    redirect_uri: redirectUri,
    scope: p.scopes.join(' '),
    response_type: 'code',
  });
  // Google requires access_type=offline for refresh tokens (not needed now, but conventional)
  if (providerId === 'google') {
    params.set('access_type', 'online');
  }
  return `${p.authEndpoint}?${params.toString()}`;
}

/**
 * Handle the full OAuth callback flow:
 * 1. Exchange code for access token
 * 2. Fetch user profile from provider
 * 3. Find or create user (with email-based merging)
 * 4. Return JWT token and frontend redirect URL
 */
export async function handleCallback(providerId, code, redirectUri, frontendUrl) {
  const p = getProvider(providerId);

  // 1. Exchange code for access token
  const accessToken = await p.exchangeCode(code, redirectUri);

  // 2. Fetch user profile
  const profile = await p.getUser(accessToken);

  // 3. Find or create user
  const user = await findOrCreateUser(providerId, profile);

  // 4. Sign JWT and build redirect URL
  const token = signToken({ userId: user.id, username: user.username });
  return { token, user };
}

/**
 * Find existing user by provider identity, merge by email, or create new user.
 */
async function findOrCreateUser(providerId, profile) {
  // Look up by provider + provider_user_id
  const existingIdentity = await query(
    'SELECT * FROM user_identities WHERE provider=$1 AND provider_user_id=$2',
    [providerId, profile.providerUserId]
  );
  if (existingIdentity.rows.length > 0) {
    // Update profile data on the identity
    await query(
      'UPDATE user_identities SET provider_email=$1, profile_data=$2 WHERE id=$3',
      [profile.email, JSON.stringify(profile.profileData), existingIdentity.rows[0].id]
    );
    // Return the associated user
    const user = await query('SELECT * FROM users WHERE id=$1', [existingIdentity.rows[0].user_id]);
    await query('UPDATE users SET avatar_url=$1, email=COALESCE($2, email) WHERE id=$3',
      [profile.avatarUrl, profile.email, user.rows[0].id]);
    return user.rows[0];
  }

  // Try email-based merging if provider email is available
  if (profile.email) {
    const emailMatch = await query('SELECT * FROM users WHERE email=$1', [profile.email]);
    if (emailMatch.rows.length > 0) {
      const user = emailMatch.rows[0];
      // Add this identity to the existing user
      await query(
        `INSERT INTO user_identities (user_id, provider, provider_user_id, provider_email, profile_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, providerId, profile.providerUserId, profile.email, JSON.stringify(profile.profileData)]
      );
      await query('UPDATE users SET avatar_url=COALESCE($1, avatar_url) WHERE id=$2',
        [profile.avatarUrl, user.id]);
      return user;
    }
  }

  // Create new user + identity
  const newUser = await query(
    'INSERT INTO users (username, email, avatar_url) VALUES ($1, $2, $3) RETURNING *',
    [profile.username, profile.email, profile.avatarUrl]
  );
  await query(
    `INSERT INTO user_identities (user_id, provider, provider_user_id, provider_email, profile_data)
     VALUES ($1, $2, $3, $4, $5)`,
    [newUser.rows[0].id, providerId, profile.providerUserId, profile.email, JSON.stringify(profile.profileData)]
  );
  return newUser.rows[0];
}

/**
 * Get all enabled providers for the frontend to display login buttons.
 */
export function getProviderList() {
  return getEnabledProviders().map(p => ({ id: p.id, name: p.name }));
}
```

- [ ] **Step 2: Commit**

```bash
git add platform/api-server/src/services/oauth/index.js
git commit -m "feat(oauth): add generic OAuth handler with email-based account merging"
```

---

### Task 4: Rewrite Auth Routes

**Files:**
- Modify: `platform/api-server/src/routes/auth.js`

- [ ] **Step 1: Replace the entire auth.js with parameterized routes**

Replace the content of `platform/api-server/src/routes/auth.js` with:

```js
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { signToken } from '../middleware/jwtAuth.js';
import { getAuthorizationUrl, handleCallback, getProviderList } from '../services/oauth/index.js';

const router = Router();

// GET /api/auth/providers — list enabled OAuth providers
router.get('/providers', (req, res) => {
  res.json(getProviderList());
});

// GET /api/auth/:provider — get OAuth authorization URL
router.get('/:provider', (req, res) => {
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/${req.params.provider}/callback`;
    const url = getAuthorizationUrl(req.params.provider, redirectUri);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/:provider/callback — OAuth callback
router.get('/:provider/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/${req.params.provider}/callback`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const { token } = await handleCallback(req.params.provider, code, redirectUri, frontendUrl);

    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// GET /api/auth/me — get current user info with identities (requires JWT)
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    const userResult = await query(
      'SELECT id, username, email, avatar_url, api_key FROM users WHERE id=$1',
      [payload.userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const identitiesResult = await query(
      'SELECT provider, provider_email, provider_user_id FROM user_identities WHERE user_id=$1',
      [payload.userId]
    );

    res.json({ ...userResult.rows[0], identities: identitiesResult.rows });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add platform/api-server/src/routes/auth.js
git commit -m "feat(oauth): rewrite auth routes with parameterized provider endpoints"
```

---

### Task 5: Clean Up Old GitHub OAuth Service

**Files:**
- Modify: `platform/api-server/src/services/github.js`

- [ ] **Step 1: Remove OAuth functions, keep repo-related functions**

Replace the content of `platform/api-server/src/services/github.js` with:

```js
import { config } from '../config.js';

const GITHUB_API = 'https://api.github.com';

// NOTE: OAuth functions (getAccessToken, getUserInfo) have moved to
// services/oauth/providers/github.js. This file now only contains
// GitHub API helpers that need a user access token.

export async function getUserRepos(accessToken) {
  const res = await fetch(`${GITHUB_API}/user/repos?per_page=100&sort=updated`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GitHub repos fetch failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add platform/api-server/src/services/github.js
git commit -m "refactor(github): remove OAuth functions, keep repo API helpers"
```

---

### Task 6: Frontend — Multi-Provider Login (Login page + Landing page + i18n)

**Files:**
- Modify: `platform/web/src/api.js`
- Modify: `platform/web/src/pages/Login.jsx`
- Modify: `platform/web/src/pages/Landing.jsx`
- Modify: `platform/web/src/i18n/translations.js`

- [ ] **Step 1: Update api.js — parameterize `getLoginUrl`**

In `platform/web/src/api.js`, change the `getLoginUrl` line:

Change this:
```js
getLoginUrl: () => request('/api/auth/github'),
```

To this:
```js
getLoginUrl: (provider = 'github') => request(`/api/auth/${provider}`),
```

Keep all other methods (`stopProject`, etc.) unchanged.

- [ ] **Step 2: Add i18n translations for Google login**

In `platform/web/src/i18n/translations.js`, add new login-related keys.

Add after `'login.github_btn'` (line ~85 in English section):
```js
    'login.google_btn': 'Login with Google',
    'login.providers_title': 'Choose a login method',
```

Add after `'login.github_btn'` (line ~232 in Chinese section):
```js
    'login.google_btn': '使用 Google 登录',
    'login.providers_title': '选择登录方式',
```

- [ ] **Step 3: Update Login.jsx — multi-provider buttons with i18n**

Replace the content of `platform/web/src/pages/Login.jsx` with:

```jsx
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { setToken, getToken } from '../auth';
import { api } from '../api';
import { useI18n } from '../i18n/context';
import LanguageSwitcher from '../i18n/switcher';

const S = {
  wrap: {
    display:'flex',alignItems:'center',justifyContent:'center',
    minHeight:'100vh',padding:'24px',
  },
  card: {
    textAlign:'center',maxWidth:'560px',width:'100%',
    animation:'fadeIn .6s ease',
  },
  ascii: {
    fontSize:'13px',lineHeight:1.3,color:'var(--text-dim)',
    whiteSpace:'pre',marginBottom:'48px',userSelect:'none',
    letterSpacing:'0',
  },
  title: {
    fontSize:'24px',fontWeight:500,letterSpacing:'0.3em',
    textTransform:'uppercase',marginBottom:'16px',
  },
  subtitle: {
    fontSize:'15px',color:'var(--text-dim)',marginBottom:'56px',
    maxWidth:'380px',margin:'0 auto 56px',lineHeight:1.8,
  },
  btn: {
    display:'inline-flex',alignItems:'center',gap:'10px',
    padding:'14px 40px',fontSize:'14px',fontWeight:500,
    backgroundColor:'transparent',color:'var(--text)',
    border:'1px solid var(--border-light)',cursor:'pointer',
    transition:'all .15s',
    textTransform:'uppercase',letterSpacing:'0.15em',
  },
  btnGroup: {
    display:'flex',flexDirection:'column',alignItems:'center',gap:'12px',
  },
  cursor: {
    display:'inline-block',width:'10px',height:'20px',
    backgroundColor:'var(--accent)',
    animation:'blink 1s step-end infinite',
    verticalAlign:'text-bottom',marginLeft:'2px',
  },
  divider: {
    width:'48px',height:'1px',backgroundColor:'var(--border-light)',
    margin:'40px auto',
  },
  footer: {
    fontSize:'12px',color:'var(--text-muted)',marginTop:'56px',
  },
};

// Provider list — each has an id matching the API route param and an i18n key
const PROVIDERS = [
  { id: 'github', btnKey: 'login.github_btn' },
  { id: 'google', btnKey: 'login.google_btn' },
];

export default function Login({ onLogin }) {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null); // which provider id is loading
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setToken(token);
      if (onLogin) onLogin();
      navigate('/');
      return;
    }
    if (getToken()) navigate('/');
  }, []);

  async function handleLogin(providerId) {
    setLoading(providerId);
    setError(null);
    try {
      const { url } = await api.getLoginUrl(providerId);
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setLoading(null);
    }
  }

  const ascii = `    ⠀⣠⣶⣶⣦⣄⠀⠀⠀⠀⣠⣶⣶⣦⡀
    ⠀⣿⣿⣿⣿⣿⡇⠀⠀⢠⣿⣿⣿⣿⣿
    ⠀⠘⣿⣿⣿⣿⠃⠀⠀⢸⣿⣿⣿⣿⡇
    ⠀⠀⠘⠛⠛⠛⠀⠀⠀⠀⠘⠛⠛⠟⠃`;

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.ascii}>{ascii}</div>
        <h1 style={S.title}>{t('brand.name')}</h1>
        <p style={S.subtitle}>
          {t('login.subtitle').split('\n').map((line, i) => (
            <span key={i}>{i > 0 && <br />}{line}</span>
          ))}
        </p>
        {error && (
          <div style={{
            color:'var(--danger)',fontSize:'13px',marginBottom:'20px',
            padding:'10px 16px',border:'1px solid var(--danger)',
            display:'inline-block',
          }}>! {error}</div>
        )}
        <div style={S.btnGroup}>
          {PROVIDERS.map(prov => (
            <button
              key={prov.id}
              onClick={() => handleLogin(prov.id)}
              disabled={loading !== null}
              style={{
                ...S.btn,
                width:'280px',
                justifyContent:'center',
                opacity: loading !== null && loading !== prov.id ? 0.4 : 1,
                cursor: loading !== null ? 'wait' : 'pointer',
              }}
              onMouseEnter={e => { if(!loading) e.target.style.borderColor='var(--text)'; }}
              onMouseLeave={e => { e.target.style.borderColor='var(--border-light)'; }}
            >
              {loading === prov.id ? t('login.connecting') : t(prov.btnKey)}
              {loading !== prov.id && <span style={S.cursor} />}
            </button>
          ))}
        </div>
        <div style={S.divider} />
        <p style={S.footer}>{t('login.footer')}</p>
        <div style={{marginTop:'24px'}}><LanguageSwitcher /></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update Landing.jsx — multi-provider support**

The Landing page has 3 login buttons (nav, hero CTA, footer). Replace `handleLogin` and the `useEffect` to support selecting a provider.

In `platform/web/src/pages/Landing.jsx`, change the `useEffect` and `handleLogin`:

```jsx
export default function Landing() {
  const { t, lang } = useI18n();
  const [loginUrl, setLoginUrl] = useState(null);
  const [showProviderMenu, setShowProviderMenu] = useState(false);

  // Pre-fetch GitHub login URL (primary CTA, keep for backward compat)
  useEffect(() => {
    api.getLoginUrl('github').then(({ url }) => setLoginUrl(url)).catch(() => {});
  }, []);

  function handleLogin(provider = 'github') {
    if (provider === 'github' && loginUrl) {
      window.location.href = loginUrl;
      return;
    }
    // For other providers, fetch and redirect
    api.getLoginUrl(provider).then(({ url }) => {
      window.location.href = url;
    }).catch(() => {});
  }
  // ... rest of the component stays the same, but replace the nav login button
```

And replace the nav login button (around line 248-255) to show a simple dropdown or just use the GitHub login from the pre-fetched URL:

The nav button:
```jsx
<button style={{
  ...S.navLink,
  padding:'6px 16px',border:'1px solid var(--border-light)',
}}
  onClick={() => handleLogin('github')}
  onMouseEnter={e=>{e.target.style.borderColor='var(--text)';e.target.style.color='var(--text)'}}
  onMouseLeave={e=>{e.target.style.borderColor='var(--border-light)';e.target.style.color='var(--text-dim)'}}
>{t('nav.login')}</button>
```

The hero CTA button(s) — add a secondary login button instead of the "how it works" ghost button at the current position, or keep the primary CTA as GitHub and add a "More options" text link:

```jsx
<div style={S.heroCtaRow}>
  <button style={S.btnPrimary}
    onClick={() => handleLogin('github')}
    onMouseEnter={e=>e.target.style.opacity='0.85'}
    onMouseLeave={e=>e.target.style.opacity='1'}
  >
    {t('landing.hero.cta')}
    <span style={S.cursor} />
  </button>
  <a href="/login" style={S.btnGhost}
    onMouseEnter={e=>{e.target.style.borderColor='var(--text)';e.target.style.backgroundColor='var(--surface)'}}
    onMouseLeave={e=>{e.target.style.borderColor='var(--border-light)';e.target.style.backgroundColor='transparent'}}
  >
    {t('landing.hero.cta_secondary')}
  </a>
</div>
```

The footer login button:
```jsx
<button onClick={() => handleLogin('github')} style={{
  ...S.footerLink,background:'none',border:'none',
  fontFamily:'var(--font)',cursor:'pointer',
}}
  onMouseEnter={e=>e.target.style.color='var(--text)'}
  onMouseLeave={e=>e.target.style.color='var(--text-dim)'}
>{t('footer.login')}</button>
```

**Design decision for Landing:** The Landing page keeps GitHub as the primary CTA (one-click). Users wanting Google login go to `/login` page via the secondary button. This preserves the Landing page's clean single-CTA UX while still providing access to Google login. The `/login` page shows all provider buttons equally.

- [ ] **Step 5: Commit**

```bash
git add platform/web/src/api.js \
        platform/web/src/pages/Login.jsx \
        platform/web/src/pages/Landing.jsx \
        platform/web/src/i18n/translations.js
git commit -m "feat(web): add multi-provider login with i18n (GitHub + Google)"
```

---

### Task 7: Environment Variables

**Files:**
- Modify: `platform/.env.example`

- [ ] **Step 1: Add Google OAuth variables**

Add the Google OAuth config lines to `platform/.env.example`, after the existing GitHub block:

The file should be:

```env
# PostgreSQL
POSTGRES_USER=plat
POSTGRES_PASSWORD=change-me
POSTGRES_DB=plat

# API Server
JWT_SECRET=change-me-jwt
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# GitHub OAuth
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# Docker Registry (cloud vendor)
REGISTRY_URL=registry.cn-hangzhou.aliyuncs.com
REGISTRY_NAMESPACE=plat

# Platform domain
PLATFORM_DOMAIN=platform.local

# Let's Encrypt (replace with real email in production)
LETSENCRYPT_EMAIL=admin@example.com
```

- [ ] **Step 2: Commit**

```bash
git add platform/.env.example
git commit -m "feat(config): add Google OAuth env vars to .env.example"
```

---

### Task 8: Production Deployment & Migration Steps

**This task documents the production rollout procedure.** No code changes.

- [ ] **Step 1: Pre-deployment — backup database**

```bash
# Dump the full database before migration (run on production host)
docker compose exec postgres pg_dump -U plat plat > ~/plat-db-backup-$(date +%Y%m%d-%H%M%S).sql
echo "Backup saved to ~/plat-db-backup-*.sql"
```

- [ ] **Step 2: Pre-deployment — verify current DB state**

```bash
# Confirm we have existing users with github_id
docker compose exec postgres psql -U plat -d plat -c "
  SELECT count(*) as total_users,
         count(github_id) as users_with_github_id
  FROM users;
"
```

Expected: `total_users` should equal `users_with_github_id` if all users logged in via GitHub.

- [ ] **Step 3: Pre-deployment — configure Google OAuth credentials**

Add to production `.env`:

```env
GOOGLE_OAUTH_CLIENT_ID=<your-google-client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<your-google-client-secret>
```

To obtain these:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add Authorized redirect URI: `https://<your-platform-domain>/api/auth/google/callback`
4. Copy Client ID and Client Secret

- [ ] **Step 4: Deploy — rolling restart**

```bash
# Pull latest code
git pull origin main

# Rebuild and restart only the api-server (migration runs on startup)
cd platform
docker compose up -d --build api-server

# Wait for migration to complete
sleep 5
docker compose logs api-server | grep -E "Migration|schema"
```

Expected log output:
```
Running 1 pending migration(s) (current version: 0)...
  Migration v1: migrate github_id from users to user_identities, then drop column...
  Migration v1: ✓ applied
All migrations applied. DB now at version 1
Database schema initialized
API Server listening on port 3000
```

- [ ] **Step 5: Post-deployment — verify migration**

```bash
# Check migration version
docker compose exec postgres psql -U plat -d plat -c "SELECT * FROM schema_migrations;"

# Verify user_identities has the migrated data
docker compose exec postgres psql -U plat -d plat -c "
  SELECT ui.provider, count(*) as identities
  FROM user_identities ui
  GROUP BY ui.provider;
"

# Confirm github_id column is gone from users
docker compose exec postgres psql -U plat -d plat -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name='users' AND column_name='github_id';
"
```

Expected:
- `schema_migrations` shows version 1
- `identities` count matches previous `users_with_github_id` count
- Last query returns 0 rows (column removed)

- [ ] **Step 6: Post-deployment — rebuild frontend**

```bash
cd platform/web && npm run build
# If using Docker for frontend:
docker compose up -d --build web
```

- [ ] **Step 7: Post-deployment — smoke test login flow**

```bash
# Test GitHub OAuth still works
curl -s https://<your-platform-domain>/api/auth/github | python3 -m json.tool
# Expected: { "url": "https://github.com/login/oauth/authorize?..." }

# Test Google OAuth endpoint appears
curl -s https://<your-platform-domain>/api/auth/providers | python3 -m json.tool
# Expected: [{ "id": "github", "name": "GitHub" }, { "id": "google", "name": "Google" }]
```

- [ ] **Step 8: Rollback procedure (if migration fails)**

If migration v1 fails (very unlikely — only moves data and drops column):

```bash
# Restore from backup
docker compose exec -T postgres psql -U plat -d plat < ~/plat-db-backup-YYYYMMDD-HHMMSS.sql

# Roll back code to previous commit
git revert <migration-commit-hash>
docker compose up -d --build api-server

# Verify users can log in with GitHub
curl -s https://<your-platform-domain>/api/auth/github
```

If migration succeeds but Google OAuth has issues:
- No rollback needed — Google is additive, GitHub path is unaffected
- Simply remove `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` from `.env` and restart api-server; Google button disappears from the frontend automatically (`getEnabledProviders` filters out providers with no credentials)

---

### Task 9: Verification — Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Start services and verify API starts without errors**

```bash
cd platform && docker compose up -d
# Wait a few seconds for services to start
docker compose logs api-server | tail -20
```

Expected: No crash, "Database schema initialized" and "API Server listening on port 3000" in logs.

- [ ] **Step 2: Verify /api/auth/providers endpoint**

```bash
curl -s http://localhost:3000/api/auth/providers | python3 -m json.tool
```

Expected: JSON array containing `{"id":"github","name":"GitHub"}` (Google won't appear until env vars are set, which is correct behavior for `getEnabledProviders()`).

- [ ] **Step 3: Verify /api/auth/github still works (backward compat via parameterized route)**

```bash
curl -s http://localhost:3000/api/auth/github | python3 -m json.tool
```

Expected: JSON with `{"url":"https://github.com/login/oauth/authorize?..."}`

- [ ] **Step 4: Verify frontend login page renders without errors**

```bash
cd platform/web && npm run dev &
sleep 3
# Open in browser or check that build succeeds
cd platform/web && npm run build
```

Expected: `npm run build` completes without errors.

---

## Self-Review

### Spec Coverage
- ✅ Database: `user_identities` table, versioned migration — Task 1
- ✅ Account merging by email — Task 3 (`findOrCreateUser`)
- ✅ Generic OAuth routes (`/:provider`, `/:provider/callback`) — Task 4
- ✅ OAuth service abstraction with providers — Task 2 + Task 3
- ✅ Google OAuth provider — Task 2, Step 3
- ✅ GitHub OAuth provider — Task 2, Step 2
- ✅ Config: Google env vars — Task 2 Step 1 + Task 7
- ✅ Frontend multi-button (Login.jsx + Landing.jsx + i18n) — Task 6
- ✅ i18n translations for Google login (zh + en) — Task 6 Step 2
- ✅ Landing page: GitHub as primary CTA, `/login` page for multi-provider choice — Task 6 Step 4
- ✅ `api.js` getLoginUrl parameterized — Task 6 Step 1
- ✅ `/me` endpoint returns identities — Task 4
- ✅ Backward compat (old GitHub routes work) — Task 4
- ✅ Versioned migration system (`schema_migrations` table) — Task 1
- ✅ Production deployment steps (pre-deploy backup, rolling restart, post-deploy verification) — Task 8
- ✅ Rollback procedure — Task 8 Step 8

### Placeholder Scan
- No TBD, TODO, or incomplete sections
- All code steps have complete implementations
- All commands have expected output

### Type Consistency
- Provider interface: `id`, `name`, `authEndpoint`, `tokenEndpoint`, `userInfoEndpoint`, `clientId()`, `clientSecret()`, `scopes`, `exchangeCode()`, `getUser()` — consistent across github.js, google.js, and usage in oauth/index.js
- `getUser()` returns `{ providerUserId, email, username, avatarUrl, profileData }` — used consistently in `findOrCreateUser()`
- `getAuthorizationUrl()` and `handleCallback()` signatures match route usage
- Migration version type: integer PRIMARY KEY — consistent between `schema_migrations` table and `MIGRATIONS` array entries
