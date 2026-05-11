import { NextResponse } from 'next/server';
import { taskStore } from '@/lib/taskStore';
import { parseUrl } from '@/lib/utils/urlParser';
import { runPipeline } from '@/lib/pipeline';
import { getInviteCode } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const inviteCode = getInviteCode(request);
    if (!inviteCode) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '请提供有效的链接' }, { status: 400 });
    }

    const parsed = parseUrl(url);
    const task = taskStore.createTask(parsed.originalUrl, parsed.source, '', inviteCode);

    // Start pipeline asynchronously — don't await
    runPipeline(task.id).catch(() => {
      // errors are handled inside runPipeline
    });

    return NextResponse.json({
      taskId: task.id,
      source: parsed.source,
      status: task.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
