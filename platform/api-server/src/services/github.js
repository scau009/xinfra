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
