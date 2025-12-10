import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForToken, type StoredAuthData } from '@/lib/auth/oauth';
import { AUTH_COOKIE_NAME, OAUTH_STATE_COOKIE_NAME, type OAuthRegion } from '@/lib/auth/constants';

interface OAuthState {
  verifier: string;
  state: string;
  region: OAuthRegion;
  redirectUri: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const origin = request.nextUrl.origin;
  const cookieStore = await cookies();

  // Handle OAuth errors
  if (error) {
    const errorMsg = errorDescription || error;
    cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(errorMsg)}`);
  }

  // Validate code and state
  if (!code || !state) {
    cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
    return NextResponse.redirect(`${origin}/?auth_error=missing_code_or_state`);
  }

  // Retrieve and validate stored state
  const storedStateCookie = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value;
  if (!storedStateCookie) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_oauth_state`);
  }

  let storedState: OAuthState;
  try {
    storedState = JSON.parse(storedStateCookie);
  } catch {
    cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
    return NextResponse.redirect(`${origin}/?auth_error=invalid_oauth_state`);
  }

  // Verify state matches (CSRF protection)
  if (state !== storedState.state) {
    cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
    return NextResponse.redirect(`${origin}/?auth_error=state_mismatch`);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForToken(
      storedState.region,
      code,
      storedState.verifier,
      storedState.redirectUri
    );

    // Validate we have a project
    if (!tokenResponse.scoped_teams || tokenResponse.scoped_teams.length === 0) {
      cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
      return NextResponse.redirect(`${origin}/?auth_error=no_project_access`);
    }

    // Store auth data in HttpOnly cookie
    const authData: StoredAuthData = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
      projectId: tokenResponse.scoped_teams[0],
      region: storedState.region,
    };

    cookieStore.set(AUTH_COOKIE_NAME, JSON.stringify(authData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Clean up OAuth state cookie
    cookieStore.delete(OAUTH_STATE_COOKIE_NAME);

    // Redirect to app
    return NextResponse.redirect(`${origin}/`);

  } catch (err) {
    console.error('Token exchange error:', err);
    cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
    const errorMsg = err instanceof Error ? err.message : 'token_exchange_failed';
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(errorMsg)}`);
  }
}
