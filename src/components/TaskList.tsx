'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import ConfirmModal from './ConfirmModal';
import Toast from './Toast';

interface TaskItem {
  id: string;
  url: string;
  source: string;
  title: string;
  status: string;
  hasFiles: boolean;
  createdAt: string;
  completedAt?: string;
}

interface ModalState {
  taskId: string;
  title: string;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export default function TaskList() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [vaultModal, setVaultModal] = useState<{ taskId: string } | null>(null);
  const [vaultPath, setVaultPath] = useState('');

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleDeleteClick = (taskId: string, title: string) => {
    setModal({ taskId, title });
  };

  const handleDeleteConfirm = async () => {
    if (!modal) return;
    const { taskId } = modal;
    setModal(null);
    setDeleting(taskId);

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        setToast({ message: '已删除', type: 'success' });
      } else {
        setToast({ message: '删除失败', type: 'error' });
      }
    } catch {
      setToast({ message: '删除失败: 网络错误', type: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  const handleSyncObsidian = async (taskId: string) => {
    setSyncing(taskId);
    try {
      const res = await fetch(`/api/obsidian/${taskId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: '已同步到 Obsidian', type: 'success' });
      } else if (data.code === 'NO_VAULT_PATH') {
        setVaultModal({ taskId });
        setVaultPath('');
      } else {
        setToast({ message: `同步失败: ${data.error}`, type: 'error' });
      }
    } catch {
      setToast({ message: '同步失败: 网络错误', type: 'error' });
    } finally {
      setSyncing(null);
    }
  };

  const handleSaveVaultPath = async () => {
    if (!vaultModal || !vaultPath.trim()) return;
    const { taskId } = vaultModal;

    try {
      const saveRes = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'obsidian_vault_path', value: vaultPath.trim() }),
      });

      if (!saveRes.ok) {
        setToast({ message: '路径保存失败', type: 'error' });
        return;
      }

      setVaultModal(null);
      // Retry sync with the newly saved path
      handleSyncObsidian(taskId);
    } catch {
      setToast({ message: '保存失败: 网络错误', type: 'error' });
    }
  };

  const completedTasks = tasks.filter((t) => t.status === 'completed' || t.status === 'failed');

  if (loading) {
    return <p className="text-center text-foreground/30 text-sm py-8">加载中...</p>;
  }

  if (completedTasks.length === 0) {
    return (
      <p className="text-center text-foreground/30 text-sm py-16">暂无历史记录</p>
    );
  }

  return (
    <>
      <div className="w-full">
        <div className="flex flex-col gap-2">
          {completedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-foreground/5 hover:bg-foreground/8 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/result/${task.id}`}
                  className="text-sm font-medium truncate block hover:text-blue-500 transition-colors"
                >
                  {task.title}
                </Link>
                <p className="text-xs text-foreground/40 mt-0.5">
                  {task.source === 'bilibili' ? 'B站' : '小宇宙'} &middot;{' '}
                  {new Date(task.createdAt).toLocaleDateString('zh-CN')}
                  {task.status === 'failed' && (
                    <span className="text-red-400 ml-2">失败</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {task.hasFiles && (
                  <>
                    <a
                      href={`/api/download/${task.id}`}
                      className="px-2 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      .md
                    </a>
                    <a
                      href={`/api/mindmap/${task.id}?format=xmind`}
                      className="px-2 py-1 rounded text-xs bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                    >
                      .xmind
                    </a>
                    <a
                      href={`/api/mindmap/${task.id}?format=png`}
                      className="px-2 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      PNG
                    </a>
                    <button
                      onClick={() => handleSyncObsidian(task.id)}
                      disabled={syncing === task.id}
                      className="px-2 py-1 rounded text-xs bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {syncing === task.id ? '...' : 'Obsidian'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDeleteClick(task.id, task.title)}
                  disabled={deleting === task.id}
                  className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {deleting === task.id ? '...' : '删除'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <ConfirmModal
          title="删除确认"
          message={`确定删除「${modal.title}」吗？将同时删除云端存储的文件，此操作不可恢复。`}
          confirmText="删除"
          cancelText="取消"
          type="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setModal(null)}
        />
      )}

      {vaultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-foreground/20 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-base font-semibold mb-2">设置 Obsidian 仓库路径</h3>
            <p className="text-sm text-foreground/50 mb-4">
              请输入你的 Obsidian Vault 在服务器上的绝对路径，文件将保存到该目录下的「音视频笔记」文件夹中。
            </p>
            <input
              type="text"
              value={vaultPath}
              onChange={(e) => setVaultPath(e.target.value)}
              placeholder="/Users/xxx/Documents/Obsidian Vault"
              className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && vaultPath.trim()) handleSaveVaultPath(); }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setVaultModal(null)}
                className="px-4 py-2 rounded-lg text-sm bg-foreground/10 hover:bg-foreground/20 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveVaultPath}
                disabled={!vaultPath.trim()}
                className="px-4 py-2 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                保存并同步
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
