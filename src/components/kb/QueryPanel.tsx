'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Source {
  docTitle: string;
  chunkContent: string;
  score: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

export default function QueryPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const res = await fetch('/api/kb/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || '未能生成回答',
          sources: data.sources,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `查询失败: ${err instanceof Error ? err.message : '未知错误'}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-foreground/20 text-sm">
            输入问题，基于知识库进行智能问答
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-foreground/5 text-foreground'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="text-sm [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:my-1 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-foreground/20 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-foreground/70 [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-foreground/10 [&_pre]:rounded [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_a]:text-blue-400 [&_a]:underline [&_strong]:font-semibold [&_hr]:my-3 [&_hr]:border-foreground/10">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-foreground/10">
                  <p className="text-xs text-foreground/40 mb-1">参考来源</p>
                  {msg.sources.map((s, j) => (
                    <span key={j} className="inline-block text-[10px] text-foreground/40 bg-foreground/5 rounded px-2 py-0.5 mr-1 mb-1">
                      {s.docTitle} {Math.round(s.score * 100)}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-foreground/5 rounded-lg px-4 py-3">
              <span className="text-sm text-foreground/40 animate-pulse">正在思考...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入你的问题..."
          className="flex-1 px-4 py-2.5 rounded-lg border border-foreground/20 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          发送
        </button>
      </form>
    </div>
  );
}
