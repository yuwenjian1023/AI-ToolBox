import { NextResponse } from 'next/server';
import { taskStore } from '@/lib/taskStore';
import { deleteGeneratedFiles } from '@/lib/asr/aliyun';
import { cleanupTempFile } from '@/lib/utils/fileManager';
import { getInviteCode } from '@/lib/auth';

export async function DELETE(
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

  // Delete from OSS
  if (task.ossFiles) {
    await deleteGeneratedFiles(taskId);
  }

  // Delete local files
  await cleanupTempFile(task.outputPath);
  await cleanupTempFile(task.xmindPath);
  await cleanupTempFile(task.mindmapPngPath);

  // Remove from store
  taskStore.deleteTask(taskId);

  return NextResponse.json({ success: true });
}
