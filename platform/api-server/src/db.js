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
