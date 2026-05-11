import { NextResponse } from 'next/server';
import { taskStore } from '@/lib/taskStore';
import { getInviteCode } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const inviteCode = getInviteCode(request);
  if (!inviteCode) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { taskId } = await params;
  const task = taskStore.getTask(taskId);

  if (!task || task.inviteCode !== inviteCode) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 });
  }

  return NextResponse.json({
    id: task.id,
    url: task.url,
    source: task.source,
    title: task.title,
    status: task.status,
    progress: task.progress,
    statusMessage: task.statusMessage,
    markdown: task.markdown,
    mermaidCode: task.mermaidCode,
    outputPath: task.outputPath,
    hasMindmapPng: !!task.ossFiles?.png || !!task.mindmapPngPath,
    hasXmind: !!task.ossFiles?.xmind || !!task.xmindPath,
    error: task.error,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
  });
}
