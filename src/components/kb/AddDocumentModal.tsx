'use client';

import { useState } from 'react';

type Tab = 'text' | 'url' | 'upload' | 'feishu' | 'audio';

interface Props {
  audioTasks: Array<{ id: string; title: string }>;
  onClose: () => void;
  onAdded: () => void;
}

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'text', label: '文本' },
  { key: 'url', label: '网页链接' },
  { key: 'upload', label: '上传文件' },
  { key: 'feishu', label: '飞书表格' },
  { key: 'audio', label: '音视频笔记' },
];

export default function AddDocumentModal({ audioTasks, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<Tab>('text');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Text
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');

  // URL
  const [url, setUrl] = useState('');
  const [crawlSite, setCrawlSite] = useState(false);

  // Feishu
  const [feishuUrl, setFeishuUrl] = useState('');

  // Audio
  const [selectedTaskId, setSelectedTaskId] = useState('');

  const handleSubmitText = async () => {
    if (!textContent.trim()) return setError('请输入内容');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/kb/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: 'text', title: title || '文本笔记', content: textContent }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      onAdded();
    } catch (e) { setError(e instanceof Error ? e.message : '提交失败'); }
    finally { setLoading(false); }
  };

  const handleSubmitUrl = async () => {
    if (!url.trim()) return setError('请输入链接');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/kb/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: crawlSite ? 'site' : 'url', title: url, url }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      onAdded();
    } catch (e) { setError(e instanceof Error ? e.message : '提交失败'); }
    finally { setLoading(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/kb/documents/upload', { method: 'POST', body: formData });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      onAdded();
    } catch (err) { setError(err instanceof Error ? err.message : '上传失败'); }
    finally { setLoading(false); }
  };

  const handleSubmitFeishu = async () => {
    if (!feishuUrl.trim()) return setError('请输入飞书表格链接');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/kb/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: 'feishu', title: '飞书表格', url: feishuUrl }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      onAdded();
    } catch (e) { setError(e instanceof Error ? e.message : '提交失败'); }
    finally { setLoading(false); }
  };

  const handleSubmitAudio = async () => {
    if (!selectedTaskId) return setError('请选择一个音视频任务');
    setLoading(true);
    setError('');
    try {
      const task = audioTasks.find((t) => t.id === selectedTaskId);
      const res = await fetch('/api/kb/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: 'audio_import', title: task?.title || '音视频笔记', taskId: selectedTaskId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      onAdded();
    } catch (e) { setError(e instanceof Error ? e.message : '提交失败'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border border-foreground/10 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">添加文档</h3>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-foreground/5 rounded-lg p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setError(''); }}
                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-foreground/50 hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'text' && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="标题（可选）"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="粘贴文本内容..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleSubmitText} disabled={loading}
                className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
                {loading ? '处理中...' : '添加'}
              </button>
            </div>
          )}

          {tab === 'url' && (
            <div className="space-y-3">
              <input
                type="url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label className="flex items-center gap-2 text-sm text-foreground/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={crawlSite}
                  onChange={(e) => setCrawlSite(e.target.checked)}
                  className="rounded"
                />
                爬取整站（自动发现并抓取子页面，最多 50 页）
              </label>
              <button onClick={handleSubmitUrl} disabled={loading}
                className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
                {loading ? (crawlSite ? '爬取中（可能需要几分钟）...' : '抓取中...') : (crawlSite ? '爬取整站' : '抓取单页')}
              </button>
            </div>
          )}

          {tab === 'upload' && (
            <div className="space-y-3">
              <label className="block w-full py-8 border-2 border-dashed border-foreground/20 rounded-lg text-center cursor-pointer hover:border-foreground/40 transition-colors">
                <p className="text-sm text-foreground/50">
                  {loading ? '上传中...' : '点击选择文件'}
                </p>
                <p className="text-xs text-foreground/30 mt-1">支持 .md .txt .docx .pdf .csv（最大 20MB）</p>
                <input type="file" className="hidden" accept=".md,.txt,.docx,.pdf,.csv" onChange={handleUpload} disabled={loading} />
              </label>
            </div>
          )}

          {tab === 'feishu' && (
            <div className="space-y-3">
              <input
                type="url"
                placeholder="飞书多维表格链接..."
                value={feishuUrl}
                onChange={(e) => setFeishuUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-foreground/30">需要在 .env.local 中配置 FEISHU_APP_ID 和 FEISHU_APP_SECRET</p>
              <button onClick={handleSubmitFeishu} disabled={loading}
                className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
                {loading ? '拉取中...' : '拉取并添加'}
              </button>
            </div>
          )}

          {tab === 'audio' && (
            <div className="space-y-3">
              {audioTasks.length === 0 ? (
                <p className="text-sm text-foreground/40 py-4 text-center">暂无已完成的音视频任务</p>
              ) : (
                <>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">选择一个音视频任务...</option>
                    {audioTasks.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                  <button onClick={handleSubmitAudio} disabled={loading}
                    className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
                    {loading ? '导入中...' : '导入'}
                  </button>
                </>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </div>
      </div>
    </div>
  );
}
