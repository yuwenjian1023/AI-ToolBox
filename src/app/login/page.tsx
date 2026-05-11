'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '验证失败');
        return;
      }

      router.push('/');
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">AI 工具箱</h1>
          <p className="text-foreground/60">请输入邀请码以继续</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError('');
            }}
            placeholder="请输入邀请码（如 A3F1-B7C2）"
            className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground text-center text-lg tracking-widest placeholder:text-foreground/30 placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
            autoFocus
          />

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '验证中...' : '进入'}
          </button>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
        </form>
      </div>
    </main>
  );
}
