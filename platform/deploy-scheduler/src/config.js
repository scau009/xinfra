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
