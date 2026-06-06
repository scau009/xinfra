import { query } from '../db.js';

export async function apiKeyAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' });
  }
  try {
    const apiKey = header.slice(7);
    const result = await query('SELECT id, username FROM users WHERE api_key=$1', [apiKey]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    req.user = { userId: result.rows[0].id, username: result.rows[0].username };
    next();
  } catch (err) {
    console.error('API key auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}
