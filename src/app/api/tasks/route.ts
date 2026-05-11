import { NextResponse } from 'next/server';
import { taskStore } from '@/lib/taskStore';
import { getInviteCode } from '@/lib/auth';

export async function GET(request: Request) {
  const inviteCode = getInviteCode(request);
  if (!inviteCode) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const tasks = taskStore.getAllTasks(inviteCode).map((t) => ({
    id: t.id,
    url: t.url,
    source: t.source,
    title: t.title,
    status: t.status,
    hasFiles: !!t.ossFiles?.md,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
  }));

  return NextResponse.json(tasks);
}
