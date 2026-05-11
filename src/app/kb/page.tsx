'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import DocumentList from '@/components/kb/DocumentList';
import AddDocumentModal from '@/components/kb/AddDocumentModal';
import QueryPanel from '@/components/kb/QueryPanel';

interface Doc {
  id: string;
  title: string;
  sourceType: string;
  chunkCount: number;
  status: string;
  error?: string;
  createdAt: string;
}

interface AudioTask {
  id: string;
  title: string;
}

export default function KBPage() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [audioTasks, setAudioTasks] = useState<AudioTask[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/kb/documents');
      const data = await res.json();
      setDocuments(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const fetchAudioTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setAudioTasks(
        data.filter((t: { status: string }) => t.status === 'completed')
            .map((t: { id: string; title: string }) => ({ id: t.id, title: t.title }))
      );
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchAudioTasks();
  }, [fetchDocuments, fetchAudioTasks]);

  // Auto-refresh processing documents
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'processing' || d.status === 'pending');
    if (!hasProcessing) return;

    const timer = setInterval(fetchDocuments, 3000);
    return () => clearInterval(timer);
  }, [documents, fetchDocuments]);

  const handleAdded = () => {
    setShowAdd(false);
    fetchDocuments();
  };

  const handleDeleted = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const readyCount = documents.filter((d) => d.status === 'ready').length;

  return (
    <main className="flex-1 flex flex-col px-4 py-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-blue-500 hover:underline mb-2 inline-block">
            &larr; AI 工具箱
          </Link>
          <h1 className="text-xl font-bold">智能知识库</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          添加文档
        </button>
      </div>

      {/* Main content: two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Left: Document list */}
        <div className="flex flex-col">
          <h2 className="text-sm font-medium text-foreground/50 mb-3">
            文档列表 {readyCount > 0 && <span className="text-foreground/30">({readyCount} 个就绪)</span>}
          </h2>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-center text-foreground/30 text-sm py-8">加载中...</p>
            ) : (
              <DocumentList documents={documents} onDeleted={handleDeleted} />
            )}
          </div>
        </div>

        {/* Right: Query panel */}
        <div className="flex flex-col border border-foreground/10 rounded-xl p-4 min-h-[400px]">
          <h2 className="text-sm font-medium text-foreground/50 mb-3">智能问答</h2>
          <div className="flex-1 flex flex-col min-h-0">
            <QueryPanel />
          </div>
        </div>
      </div>

      {/* Add document modal */}
      {showAdd && (
        <AddDocumentModal
          audioTasks={audioTasks}
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
        />
      )}
    </main>
  );
}
