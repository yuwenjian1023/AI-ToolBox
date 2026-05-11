import { taskStore } from '@/lib/taskStore';
import { getFileUrl } from '@/lib/asr/aliyun';
import { readFile } from '@/lib/utils/fileManager';
import { getInviteCode } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const inviteCode = getInviteCode(request);
  if (!inviteCode) {
    return new Response('未登录', { status: 401 });
  }

  const { taskId } = await params;
  const task = taskStore.getTask(taskId);

  if (!task || task.inviteCode !== inviteCode) {
    return new Response('任务不存在', { status: 404 });
  }

  // Prefer OSS
  if (task.ossFiles?.md) {
    const url = getFileUrl(task.ossFiles.md);
    return Response.redirect(url, 302);
  }

  // Fallback to local file
  if (!task.outputPath) {
    return new Response('文件不存在', { status: 404 });
  }

  try {
    const content = await readFile(task.outputPath);
    const filename = task.outputPath.split('/').pop() || `${taskId}.md`;
    return new Response(new Uint8Array(content), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch {
    return new Response('文件读取失败', { status: 500 });
  }
}
