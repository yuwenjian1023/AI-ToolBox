'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SubmitForm from '@/components/SubmitForm';
import ProgressPanel from '@/components/ProgressPanel';

export default function AudioPage() {
  const router = useRouter();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = (id: string) => {
    setTaskId(id);
    setError('');
  };

  const handleComplete = useCallback(() => {
    router.push('/history');
  }, [router]);

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  const handleReset = () => {
    setTaskId(null);
    setError('');
  };

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-16 relative">
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="text-sm text-blue-500 hover:underline"
        >
          &larr; AI 工具箱
        </Link>
      </div>
      <Link
        href="/history"
        className="absolute top-6 right-6 px-4 py-2 rounded-lg bg-foreground/10 hover:bg-foreground/20 transition-colors text-sm"
      >
        历史记录
      </Link>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-3">音视频转 Markdown</h1>
        <p className="text-foreground/60 max-w-md mx-auto">
          粘贴 Bilibili 视频或小宇宙播客链接，自动转录为结构化 Markdown 文档并生成思维导图
        </p>
      </div>

      {!taskId && <SubmitForm onSubmit={handleSubmit} />}

      {taskId && !error && (
        <ProgressPanel
          taskId={taskId}
          onComplete={handleComplete}
          onError={handleError}
        />
      )}

      {error && (
        <div className="w-full max-w-2xl mx-auto mt-8 text-center">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg bg-foreground/10 hover:bg-foreground/20 transition-colors text-sm"
            >
              重新开始
            </button>
          </div>
        </div>
      )}

      <div className="mt-16 text-center text-xs text-foreground/30">
        <p>支持 Bilibili 视频 / 小宇宙播客</p>
        <p className="mt-1">使用阿里云 Paraformer 语音识别 + 通义千问 内容结构化</p>
      </div>
    </main>
  );
}
