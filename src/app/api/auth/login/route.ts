import { NextResponse } from 'next/server';
import { authStore } from '@/lib/authStore';

export async function POST(request: Request) {
  const { code } = await request.json();

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: '请输入邀请码' }, { status: 400 });
  }

  const normalized = code.trim().toUpperCase();
  const valid = authStore.validateCode(normalized);

  if (!valid) {
    return NextResponse.json({ error: '邀请码无效' }, { status: 401 });
  }

  authStore.markUsed(normalized);

  const response = NextResponse.json({ success: true });
  response.cookies.set('invite_code', normalized, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
