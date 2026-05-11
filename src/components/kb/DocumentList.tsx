'use client';

import { useState } from 'react';
import SourceBadge from './SourceBadge';
import ConfirmModal from '@/components/ConfirmModal';
import Toast from '@/components/Toast';

interface Doc {
  id: string;
  title: string;
  sourceType: string;
  chunkCount: number;
  status: string;
  error?: string;
  createdAt: string;
}

interface Props {
  documents: Doc[];
  onDeleted: (docId: string) => void;
}

export default function DocumentList({ documents, onDeleted }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [modal, setModal] = useState<{ id: string; title: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleDelete = async () => {
    if (!modal) return;
    setModal(null);
    setDeleting(modal.id);
    try {
      const res = await fetch(`/api/kb/documents/${modal.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleted(modal.id);
        setToast({ message: '已删除', type: 'success' });
      }
    } catch {
      setToast({ message: '删除失败', type: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  if (documents.length === 0) {
    return <p className="text-center text-foreground/30 text-sm py-12">暂无文档，点击上方按钮添加</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-foreground/5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <SourceBadge sourceType={doc.sourceType} />
                <span className="text-sm font-medium truncate">{doc.title}</span>
              </div>
              <p className="text-xs text-foreground/40 mt-0.5">
                {doc.status === 'ready' && `${doc.chunkCount} 个片段`}
                {doc.status === 'processing' && '处理中...'}
                {doc.status === 'pending' && '等待处理'}
                {doc.status === 'failed' && <span className="text-red-400">失败: {doc.error}</span>}
                {' '}&middot; {new Date(doc.createdAt).toLocaleDateString('zh-CN')}
              </p>
            </div>
            <button
              onClick={() => setModal({ id: doc.id, title: doc.title })}
              disabled={deleting === doc.id}
              className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50 shrink-0"
            >
              {deleting === doc.id ? '...' : '删除'}
            </button>
          </div>
        ))}
      </div>

      {modal && (
        <ConfirmModal
          title="删除文档"
          message={`确定删除「${modal.title}」吗？文档及其所有向量数据将被永久删除。`}
          confirmText="删除"
          type="danger"
          onConfirm={handleDelete}
          onCancel={() => setModal(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
