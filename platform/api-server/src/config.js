import dotenv from 'dotenv';
import { existsSync } from 'fs';

// Try .env first, fall back to .env.example
const envPath = existsSync('../.env') ? '../.env' : '../.env.example';
dotenv.config({ path: envPath });

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
