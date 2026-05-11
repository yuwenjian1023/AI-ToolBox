import { NextResponse } from 'next/server';
import { getInviteCode } from '@/lib/auth';
import { authStore } from '@/lib/authStore';

const ALLOWED_KEYS = ['obsidian_vault_path'];

export async function GET(request: Request) {
  const inviteCode = getInviteCode(request);
  if (!inviteCode) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const settings: Record<string, string | null> = {};
  for (const key of ALLOWED_KEYS) {
    settings[key] = authStore.getSetting(inviteCode, key);
  }

  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  const inviteCode = getInviteCode(request);
  if (!inviteCode) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { key, value } = await request.json();

  if (!key || !ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: '不支持的设置项' }, { status: 400 });
  }

  if (!value || typeof value !== 'string' || !value.trim()) {
    return NextResponse.json({ error: '值不能为空' }, { status: 400 });
  }

  // Clean up shell-escaped paths: "Obsidian\ Vault" → "Obsidian Vault"
  const cleaned = value.trim().replace(/\\ /g, ' ');
  authStore.setSetting(inviteCode, key, cleaned);
  return NextResponse.json({ success: true });
}
