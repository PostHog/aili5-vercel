import crypto from 'crypto';
import { OAUTH_CONFIG, OAUTH_SCOPES, type OAuthRegion } from './constants';

/**
 * Generate PKCE code verifier and challenge
 * https://datatracker.ietf.org/doc/html/rfc7636
 */
export function generatePKCE(): { verifier: string; challenge: string } {
  // Generate random 32-byte verifier
  const verifier = crypto.randomBytes(32).toString('base64url');

  // Create SHA-256 hash of verifier for challenge
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');

  return { verifier, challenge };
}

/**
 * Build the OAuth authorization URL
 */
export function buildAuthorizeUrl(
  region: OAuthRegion,
  redirectUri: string,
  codeChallenge: string,
  state: string
): string {
  const config = OAUTH_CONFIG[region];
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: OAUTH_SCOPES.join(' '),
    state,
    required_access_level: 'project', // Ensures user selects a project
  });

  return `${config.baseUrl}/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForToken(
  region: OAuthRegion,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<OAuthTokenResponse> {
  const config = OAUTH_CONFIG[region];

  const response = await fetch(`${config.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      client_id: config.clientId,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  scoped_teams?: number[];
  scoped_organizations?: string[];
}

export interface StoredAuthData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  projectId: number;
  region: OAuthRegion;
}
