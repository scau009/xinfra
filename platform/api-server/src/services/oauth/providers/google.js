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
