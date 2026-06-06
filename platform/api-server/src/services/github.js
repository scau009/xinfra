import { config } from '../config.js';

const GITHUB_API = 'https://api.github.com';
const GITHUB_OAUTH = 'https://github.com/login/oauth';

export async function getAccessToken(code) {
  const res = await fetch(`${GITHUB_OAUTH}/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: config.github.oauthClientId,
      client_secret: config.github.oauthClientSecret,
      code,
    }),
  });
  if (!res.ok) throw new Error(`GitHub OAuth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export async function getUserInfo(accessToken) {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GitHub user fetch failed: ${res.status}`);
  return res.json();
}

export async function getUserRepos(accessToken) {
  const res = await fetch(`${GITHUB_API}/user/repos?per_page=100&sort=updated`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GitHub repos fetch failed: ${res.status}`);
  return res.json();
}
