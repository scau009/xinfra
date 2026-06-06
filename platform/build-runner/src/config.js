export const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  registry: {
    url: process.env.REGISTRY_URL || 'registry.local',
    namespace: process.env.REGISTRY_NAMESPACE || 'plat',
  },
};
