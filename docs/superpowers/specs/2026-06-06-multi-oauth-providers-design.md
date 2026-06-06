# Multi-Provider OAuth Authentication

Date: 2026-06-06

## Goal

Add Google OAuth login support to the web project, with a generic multi-provider architecture that makes adding future providers (GitLab, WeChat, etc.) straightforward.

## Current State

- `users` table has `github_id BIGINT UNIQUE` — single provider, one column per identity
- Only `GET /api/auth/github` and `GET /api/auth/github/callback` routes exist
- `services/github.js` handles GitHub-specific OAuth logic
- Frontend login page has a single "Login with GitHub" button
- JWT middleware is provider-agnostic (no changes needed)

## Design

### 1. Database: `user_identities` table

Decouple identity from user record using a separate identities table:

```sql
CREATE TABLE IF NOT EXISTS user_identities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,          -- 'github', 'google', ...
    provider_user_id VARCHAR(255) NOT NULL, -- provider's unique user ID
    provider_email VARCHAR(255),
    profile_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user_id ON user_identities(user_id);
```

Remove `github_id` from `users` table. Existing data migrated: each `users.github_id` becomes a `user_identities` row with `provider='github'`.

### 2. Account merging by email

When a user logs in with a new provider (e.g., Google):

1. Look up `user_identities` by `(provider, provider_user_id)` → found: login as that user
2. Not found: look up `users` by `email` matching the provider email
   - Match found: add a new `user_identities` row linking to the existing user (auto-merge)
   - No match: create new `users` row + new `user_identities` row

### 3. API: Generic OAuth routes

Replace hardcoded GitHub routes with parameterized routes:

- `GET /api/auth/:provider` — returns `{ url }` for the OAuth authorization page
- `GET /api/auth/:provider/callback` — handles OAuth callback, find-or-create user, redirect to frontend with JWT

Old `/api/auth/github` and `/api/auth/github/callback` kept as redirects for backward compatibility.

### 4. API: OAuth service abstraction

New `services/oauth/` directory:

- `index.js` — generic `getAuthorizationUrl()`, `exchangeCode()`, `getUser()`, `handleCallback()`
- `providers/github.js` — GitHub-specific config: endpoints, scopes, field mapping
- `providers/google.js` — Google-specific config: endpoints, scopes, field mapping

Each provider exports:
```js
{
  id: 'github',
  authEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  userInfoEndpoint: 'https://api.github.com/user',
  scopes: ['user:email'],
  mapUser: (profile) => ({ id, email, name, avatar }),
  // optional: custom token request headers/body
}
```

### 5. Configuration

```env
# GitHub OAuth
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
```

### 6. Frontend: Multi-button login

`Login.jsx` renders one button per enabled provider. Each button calls `GET /api/auth/:provider` to get the redirect URL. The `/auth/callback` route and token handling remain unchanged.

`api.js`:
```js
getLoginUrl: (provider = 'github') => request(`/api/auth/${provider}`),
```

## Files to change

| File | Change |
|------|--------|
| `platform/api-server/src/db.js` | Add `user_identities` table; drop `github_id` from `users`; data migration |
| `platform/api-server/src/config.js` | Add `google` OAuth config block |
| `platform/api-server/src/services/oauth/index.js` | **New** — generic OAuth handler |
| `platform/api-server/src/services/oauth/providers/github.js` | **New** — GitHub provider config |
| `platform/api-server/src/services/oauth/providers/google.js` | **New** — Google provider config |
| `platform/api-server/src/routes/auth.js` | Generic `/:provider` routes; backward compat redirects |
| `platform/api-server/src/services/github.js` | Keep for repo/webhook APIs; remove OAuth functions |
| `platform/api-server/src/routes/projects.js` | Update `github_id` references to `user_identities` |
| `platform/web/src/pages/Login.jsx` | Multi-button layout |
| `platform/api-server/src/routes/auth.js` | `/me` endpoint: return identities array instead of `github_id` |
| `platform/web/src/pages/Login.jsx` | Multi-button layout |
| `platform/web/src/api.js` | `getLoginUrl(provider)` parameterized |
| `platform/.env.example` | Add Google OAuth vars |

## Out of scope

- Other providers (GitLab, WeChat, etc.) — architecture supports them, but not implementing now
- User-initiated account linking UI (linking a second provider to existing account)
- OAuth token refresh for provider API access
