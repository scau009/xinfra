import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function jwtAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}
