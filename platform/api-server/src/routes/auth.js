import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { getAuthorizationUrl, handleCallback, getProviderList } from '../services/oauth/index.js';

const router = Router();

// ── Fixed-path routes (must be before /:provider to avoid being caught as provider param) ──

// GET /api/auth/providers — list enabled OAuth providers
router.get('/providers', (req, res) => {
  res.json(getProviderList());
});

// GET /api/auth/me — get current user info with identities (requires JWT)
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    const userResult = await query(
      'SELECT id, username, email, avatar_url, api_key FROM users WHERE id=$1',
      [payload.userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const identitiesResult = await query(
      'SELECT provider, provider_email, provider_user_id FROM user_identities WHERE user_id=$1',
      [payload.userId]
    );

    res.json({ ...userResult.rows[0], identities: identitiesResult.rows });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ── Parameterized OAuth routes ──

// GET /api/auth/:provider — get OAuth authorization URL
router.get('/:provider', (req, res) => {
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/${req.params.provider}/callback`;
    const url = getAuthorizationUrl(req.params.provider, redirectUri);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/:provider/callback — OAuth callback
router.get('/:provider/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/${req.params.provider}/callback`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const { token } = await handleCallback(req.params.provider, code, redirectUri);

    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
