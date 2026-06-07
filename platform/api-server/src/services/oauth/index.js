import { query } from '../../db.js';
import { signToken } from '../../middleware/jwtAuth.js';
import { getProvider, getEnabledProviders } from './providers/index.js';

/**
 * Build the OAuth authorization URL for a given provider.
 */
export function getAuthorizationUrl(providerId, redirectUri) {
  const p = getProvider(providerId);
  const params = new URLSearchParams({
    client_id: p.clientId(),
    redirect_uri: redirectUri,
    scope: p.scopes.join(' '),
    response_type: 'code',
  });
  // Google uses access_type=online for web-server flow (no refresh token needed)
  if (providerId === 'google') {
    params.set('access_type', 'online');
  }
  return `${p.authEndpoint}?${params.toString()}`;
}

/**
 * Handle the full OAuth callback flow:
 * 1. Exchange code for access token
 * 2. Fetch user profile from provider
 * 3. Find or create user (with email-based merging)
 * 4. Return JWT token
 */
export async function handleCallback(providerId, code, redirectUri) {
  const p = getProvider(providerId);

  // 1. Exchange code for access token
  const accessToken = await p.exchangeCode(code, redirectUri);

  // 2. Fetch user profile
  const profile = await p.getUser(accessToken);

  // 3. Find or create user
  const user = await findOrCreateUser(providerId, profile);

  // 4. Sign JWT
  const token = signToken({ userId: user.id, username: user.username });
  return { token, user };
}

/**
 * Find existing user by provider identity, merge by email, or create new user.
 */
async function findOrCreateUser(providerId, profile) {
  // Look up by provider + provider_user_id
  const existingIdentity = await query(
    'SELECT * FROM user_identities WHERE provider=$1 AND provider_user_id=$2',
    [providerId, profile.providerUserId]
  );
  if (existingIdentity.rows.length > 0) {
    // Update profile data on the identity
    await query(
      'UPDATE user_identities SET provider_email=$1, profile_data=$2 WHERE id=$3',
      [profile.email, JSON.stringify(profile.profileData), existingIdentity.rows[0].id]
    );
    // Return the associated user
    const user = await query('SELECT * FROM users WHERE id=$1', [existingIdentity.rows[0].user_id]);
    await query('UPDATE users SET avatar_url=$1, email=COALESCE($2, email) WHERE id=$3',
      [profile.avatarUrl, profile.email, user.rows[0].id]);
    return user.rows[0];
  }

  // Try email-based merging if provider email is available
  if (profile.email) {
    const emailMatch = await query('SELECT * FROM users WHERE email=$1', [profile.email]);
    if (emailMatch.rows.length > 0) {
      const user = emailMatch.rows[0];
      // Add this identity to the existing user
      await query(
        `INSERT INTO user_identities (user_id, provider, provider_user_id, provider_email, profile_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, providerId, profile.providerUserId, profile.email, JSON.stringify(profile.profileData)]
      );
      await query('UPDATE users SET avatar_url=COALESCE($1, avatar_url) WHERE id=$2',
        [profile.avatarUrl, user.id]);
      return user;
    }
  }

  // Create new user + identity
  const newUser = await query(
    'INSERT INTO users (username, email, avatar_url) VALUES ($1, $2, $3) RETURNING *',
    [profile.username, profile.email, profile.avatarUrl]
  );
  await query(
    `INSERT INTO user_identities (user_id, provider, provider_user_id, provider_email, profile_data)
     VALUES ($1, $2, $3, $4, $5)`,
    [newUser.rows[0].id, providerId, profile.providerUserId, profile.email, JSON.stringify(profile.profileData)]
  );
  return newUser.rows[0];
}

/**
 * Get all enabled providers for the frontend to display login buttons.
 */
export function getProviderList() {
  return getEnabledProviders().map(p => ({ id: p.id, name: p.name }));
}
