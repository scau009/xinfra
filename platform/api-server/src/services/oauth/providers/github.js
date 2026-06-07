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
