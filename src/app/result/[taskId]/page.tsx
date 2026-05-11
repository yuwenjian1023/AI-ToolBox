'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import MarkdownPreview from '@/components/MarkdownPreview';

interface TaskResult {
  id: string;
  title: string;
  source: string;
  url: string;
  status: string;
  markdown?: string;
  mermaidCode?: string;
  outputPath?: string;
  hasMindmapPng?: boolean;
  hasXmind?: boolean;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export default function ResultPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params);
  const [task, setTask] = useState<TaskResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/result/${taskId}`)
      .then((res) => res.json())
      .then((data) => {
        setTask(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-foreground/50">加载中...</p>
      </main>
    );
  }

  if (!task || task.error) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-red-500">{task?.error || '任务不存在'}</p>
        <Link href="/" className="text-blue-500 hover:underline text-sm">
          返回首页
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6">
        <Link href="/" className="text-sm text-blue-500 hover:underline mb-3 inline-block">
          &larr; 返回首页
        </Link>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-bold truncate shrink min-w-0">{task.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`/api/download/${taskId}`}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
            >
              下载 .md
            </a>
            {task.hasXmind && (
              <a
                href={`/api/mindmap/${taskId}?format=xmind`}
                className="px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors text-sm whitespace-nowrap"
              >
                下载 .xmind
              </a>
            )}
            {task.hasMindmapPng && (
              <a
                href={`/api/mindmap/${taskId}?format=png`}
                className="px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm whitespace-nowrap"
              >
                下载 PNG
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Markdown content */}
      <div className="bg-foreground/5 rounded-xl p-6 md:p-8">
        {task.markdown ? (
          <MarkdownPreview content={task.markdown} />
        ) : (
          <p className="text-foreground/50">暂无内容</p>
        )}
      </div>
    </main>
  );
}
