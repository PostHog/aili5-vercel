import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/auth/constants';
import type { StoredAuthData } from '@/lib/auth/oauth';

export interface AuthStatus {
  isAuthenticated: boolean;
  projectId?: number;
  region?: string;
  expiresAt?: number;
}

export async function GET() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!authCookie) {
    return NextResponse.json({ isAuthenticated: false } satisfies AuthStatus);
  }

  try {
    const authData: StoredAuthData = JSON.parse(authCookie);

    // Check if token is expired
    if (authData.expiresAt < Date.now()) {
      // TODO: Implement token refresh
      return NextResponse.json({ isAuthenticated: false } satisfies AuthStatus);
    }

    return NextResponse.json({
      isAuthenticated: true,
      projectId: authData.projectId,
      region: authData.region,
      expiresAt: authData.expiresAt,
    } satisfies AuthStatus);

  } catch {
    return NextResponse.json({ isAuthenticated: false } satisfies AuthStatus);
  }
}
