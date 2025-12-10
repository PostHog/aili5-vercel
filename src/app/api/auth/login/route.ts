import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { generatePKCE, buildAuthorizeUrl } from '@/lib/auth/oauth';
import { OAUTH_STATE_COOKIE_NAME, type OAuthRegion } from '@/lib/auth/constants';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const region = (searchParams.get('region') as OAuthRegion) || 'US';

  // Generate PKCE challenge
  const { verifier, challenge } = generatePKCE();

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('base64url');

  // Build callback URL based on request origin
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/callback`;

  // Store verifier and state in cookie for callback
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE_NAME, JSON.stringify({
    verifier,
    state,
    region,
    redirectUri,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/',
  });

  // Build authorization URL and redirect
  const authorizeUrl = buildAuthorizeUrl(region, redirectUri, challenge, state);

  return NextResponse.redirect(authorizeUrl);
}
