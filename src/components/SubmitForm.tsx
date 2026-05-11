'use client';

import { useState } from 'react';

interface Props {
  onSubmit: (taskId: string) => void;
}

export default function SubmitForm({ onSubmit }: Props) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '提交失败');
        return;
      }

      onSubmit(data.taskId);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const detectSource = (input: string) => {
    if (/bilibili\.com|b23\.tv/.test(input)) return 'Bilibili 视频';
    if (/xiaoyuzhoufm\.com/.test(input)) return '小宇宙播客';
    return null;
  };

  const source = detectSource(url);

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col gap-3">
        <label htmlFor="url-input" className="text-sm font-medium text-foreground/70">
          粘贴 Bilibili 视频链接或小宇宙播客链接
        </label>
        <div className="flex gap-2">
          <input
            id="url-input"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            placeholder="https://www.bilibili.com/video/BV... 或 https://www.xiaoyuzhoufm.com/episode/..."
            className="flex-1 px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {loading ? '提交中...' : '开始转换'}
          </button>
        </div>

        <div className="flex items-center gap-2 min-h-[1.5rem]">
          {source && (
            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {source}
            </span>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </form>
  );
}
