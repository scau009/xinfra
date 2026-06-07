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
