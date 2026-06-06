import crypto from 'crypto';
import pg from 'pg';
import { config } from './config.js';

export async function getDecryptedEnvVars(projectId) {
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT key, encrypted_value FROM env_vars WHERE project_id=$1',
      [projectId]
    );

    return result.rows.map((row) => {
      const encrypted = Buffer.from(row.encrypted_value, 'base64');
      const iv = encrypted.subarray(0, 12);
      const tag = encrypted.subarray(encrypted.length - 16);
      const ciphertext = encrypted.subarray(12, encrypted.length - 16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', config.encryptionKey, iv);
      decipher.setAuthTag(tag);
      let plaintext = decipher.update(ciphertext, null, 'utf-8');
      plaintext += decipher.final('utf-8');

      return { key: row.key, value: plaintext };
    });
  } finally {
    client.release();
    await pool.end();
  }
}
