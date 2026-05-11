import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { taskStore } from '@/lib/taskStore';
import { getFileUrl } from '@/lib/asr/aliyun';
import { getInviteCode } from '@/lib/auth';
import { authStore } from '@/lib/authStore';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const inviteCode = getInviteCode(request);
  if (!inviteCode) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { taskId } = await params;
  const vaultPath = authStore.getSetting(inviteCode, 'obsidian_vault_path');

  if (!vaultPath) {
    return NextResponse.json({ error: '未设置 Obsidian 路径', code: 'NO_VAULT_PATH' }, { status: 400 });
  }

  const task = taskStore.getTask(taskId);
  if (!task || task.inviteCode !== inviteCode) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 });
  }

  // Get markdown content: from memory or fetch from OSS
  let markdown = task.markdown;

  if (!markdown && task.ossFiles?.md) {
    try {
      const url = getFileUrl(task.ossFiles.md);
      const res = await fetch(url);
      markdown = await res.text();
    } catch {
      return NextResponse.json({ error: '获取文件内容失败' }, { status: 500 });
    }
  }

  if (!markdown) {
    return NextResponse.json({ error: '没有可同步的内容' }, { status: 404 });
  }

  // Write to Obsidian vault
  try {
    const subDir = path.join(vaultPath, '音视频笔记');
    await fs.mkdir(subDir, { recursive: true });

    const sanitizedTitle = task.title
      .replace(/[/\\?%*:|"<>]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 80);
    const filename = `${sanitizedTitle}.md`;
    const filePath = path.join(subDir, filename);

    await fs.writeFile(filePath, markdown, 'utf-8');

    return NextResponse.json({ success: true, path: filePath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `写入失败: ${msg}`, code: 'WRITE_ERROR' }, { status: 500 });
  }
}
