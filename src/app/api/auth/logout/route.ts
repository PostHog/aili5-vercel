import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/auth/constants';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);

  const origin = request.nextUrl.origin;
  return NextResponse.redirect(`${origin}/`);
}
