import { taskStore } from '@/lib/taskStore';
import { getFileUrl } from '@/lib/asr/aliyun';

export async function parseAudioImport(taskId: string): Promise<{ title: string; text: string }> {
  const task = taskStore.getTask(taskId);
  if (!task) throw new Error('音视频任务不存在');
  if (task.status !== 'completed') throw new Error('音视频任务未完成');

  // Try to get markdown from memory
  let markdown = task.markdown;

  // Fallback: fetch from OSS
  if (!markdown && task.ossFiles?.md) {
    const url = getFileUrl(task.ossFiles.md);
    const res = await fetch(url);
    markdown = await res.text();
  }

  if (!markdown) throw new Error('无法获取音视频笔记内容');

  return { title: task.title, text: markdown };
}
