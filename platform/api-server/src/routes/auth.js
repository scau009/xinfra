import { Router } from 'express';
import { getAccessToken, getUserInfo } from '../services/github.js';
import { query } from '../db.js';
import { signToken } from '../middleware/jwtAuth.js';
import jwt from 'jsonwebtoken';

const router = Router();

// GET /api/auth/github — get GitHub OAuth authorization URL
router.get('/github', (req, res) => {
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  res.json({ url });
});

// GET /api/auth/github/callback — GitHub OAuth callback
router.get('/github/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    const accessToken = await getAccessToken(code);
    const ghUser = await getUserInfo(accessToken);

    // Find or create user
    const existing = await query('SELECT * FROM users WHERE github_id = $1', [ghUser.id]);
    let user;
    if (existing.rows.length > 0) {
      user = existing.rows[0];
      await query('UPDATE users SET avatar_url=$1, email=$2 WHERE id=$3',
        [ghUser.avatar_url, ghUser.email, user.id]);
    } else {
      const result = await query(
        'INSERT INTO users (github_id, username, email, avatar_url) VALUES ($1,$2,$3,$4) RETURNING *',
        [ghUser.id, ghUser.login, ghUser.email, ghUser.avatar_url]
      );
      user = result.rows[0];
    }

    const token = signToken({ userId: user.id, username: user.username });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// GET /api/auth/me — get current user info (requires JWT)
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    const result = await query(
      'SELECT id, github_id, username, email, avatar_url, api_key FROM users WHERE id=$1',
      [payload.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
