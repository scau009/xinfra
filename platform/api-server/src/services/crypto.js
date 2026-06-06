import crypto from 'crypto';
import { config } from '../config.js';

export function encryptEnvVar(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', config.encryptionKey, iv);
  let encrypted = cipher.update(plaintext, 'utf-8', null);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv + ciphertext + tag
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

export function decryptEnvVar(encryptedBase64) {
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const iv = encrypted.subarray(0, 12);
  const tag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(12, encrypted.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', config.encryptionKey, iv);
  decipher.setAuthTag(tag);
  let plaintext = decipher.update(ciphertext, null, 'utf-8');
  plaintext += decipher.final('utf-8');
  return plaintext;
}
