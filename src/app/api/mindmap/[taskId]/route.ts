import { taskStore } from '@/lib/taskStore';
import { getFileUrl } from '@/lib/asr/aliyun';
import { readFile } from '@/lib/utils/fileManager';
import { getInviteCode } from '@/lib/auth';

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  xmind: 'application/octet-stream',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const inviteCode = getInviteCode(request);
  if (!inviteCode) {
    return new Response('未登录', { status: 401 });
  }

  const { taskId } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'png';

  const task = taskStore.getTask(taskId);
  if (!task || task.inviteCode !== inviteCode) {
    return new Response('任务不存在', { status: 404 });
  }

  // Prefer OSS
  const ossKey = format === 'xmind' ? task.ossFiles?.xmind : task.ossFiles?.png;
  if (ossKey) {
    const url = getFileUrl(ossKey);
    return Response.redirect(url, 302);
  }

  // Fallback to local file
  const filePath = format === 'xmind' ? task.xmindPath : task.mindmapPngPath;
  if (!filePath) {
    return new Response('文件不存在', { status: 404 });
  }

  try {
    const content = await readFile(filePath);
    const filename = filePath.split('/').pop() || `mindmap.${format}`;
    const contentType = CONTENT_TYPES[format] || 'application/octet-stream';

    return new Response(new Uint8Array(content), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch {
    return new Response('文件读取失败', { status: 500 });
  }
}
