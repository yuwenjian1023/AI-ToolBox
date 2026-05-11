import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import type { Task, LinkSource, TaskStatus, ProgressEvent } from '@/types';

const DB_PATH = path.resolve(process.env.OUTPUT_DIR || './output', 'tasks.db');

function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      oss_md TEXT,
      oss_xmind TEXT,
      oss_png TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    )
  `);

  const tryAlter = (sql: string) => {
    try { db.exec(sql); } catch { /* column already exists */ }
  };
  tryAlter(`ALTER TABLE tasks ADD COLUMN invite_code TEXT NOT NULL DEFAULT ''`);

  return db;
}

class TaskStore extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private loaded = false;

  private load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const db = getDb();
      // Mark interrupted tasks as failed on startup
      db.prepare(
        `UPDATE tasks SET status = 'failed', error = '服务重启，处理中断' WHERE status NOT IN ('completed', 'failed')`
      ).run();
      const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as Array<{
        id: string; url: string; source: string; title: string; status: string;
        oss_md: string | null; oss_xmind: string | null; oss_png: string | null;
        error: string | null; created_at: string; completed_at: string | null;
        invite_code: string;
      }>;
      for (const row of rows) {
        this.tasks.set(row.id, {
          id: row.id,
          url: row.url,
          source: row.source as LinkSource,
          title: row.title,
          status: row.status as TaskStatus,
          progress: row.status === 'completed' ? 100 : 0,
          statusMessage: row.status === 'completed' ? '已完成' : row.status === 'failed' ? `失败: ${row.error}` : '',
          ossFiles: (row.oss_md || row.oss_xmind || row.oss_png) ? {
            md: row.oss_md || undefined,
            xmind: row.oss_xmind || undefined,
            png: row.oss_png || undefined,
          } : undefined,
          error: row.error || undefined,
          inviteCode: row.invite_code || undefined,
          createdAt: row.created_at,
          completedAt: row.completed_at || undefined,
        });
      }
      db.close();
    } catch (err) {
      console.error('加载任务数据库失败:', err);
    }
  }

  private persist(task: Task) {
    try {
      const db = getDb();
      db.prepare(`
        INSERT OR REPLACE INTO tasks (id, url, source, title, status, oss_md, oss_xmind, oss_png, error, created_at, completed_at, invite_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.id, task.url, task.source, task.title, task.status,
        task.ossFiles?.md || null, task.ossFiles?.xmind || null, task.ossFiles?.png || null,
        task.error || null, task.createdAt, task.completedAt || null,
        task.inviteCode || '',
      );
      db.close();
    } catch (err) {
      console.error('保存任务失败:', err);
    }
  }

  createTask(url: string, source: LinkSource, title: string = '', inviteCode: string = ''): Task {
    this.load();
    const task: Task = {
      id: randomUUID().slice(0, 8),
      url,
      source,
      title: title || `任务 ${this.tasks.size + 1}`,
      status: 'pending',
      progress: 0,
      statusMessage: '等待处理...',
      inviteCode,
      createdAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  getTask(taskId: string): Task | undefined {
    this.load();
    return this.tasks.get(taskId);
  }

  getAllTasks(inviteCode?: string): Task[] {
    this.load();
    let tasks = Array.from(this.tasks.values());
    if (inviteCode) {
      tasks = tasks.filter(t => t.inviteCode === inviteCode);
    }
    return tasks.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  updateProgress(taskId: string, status: TaskStatus, progress: number, message: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = status;
    task.progress = progress;
    task.statusMessage = message;
    const event: ProgressEvent = { taskId, status, progress, message };
    this.emit(`progress:${taskId}`, event);

    if (status === 'completed' || status === 'failed') {
      this.persist(task);
    }
  }

  updateTask(taskId: string, updates: Partial<Task>) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    Object.assign(task, updates);
    if (task.status === 'completed' || task.status === 'failed') {
      this.persist(task);
    }
  }

  deleteTask(taskId: string): boolean {
    this.load();
    const deleted = this.tasks.delete(taskId);
    if (deleted) {
      try {
        const db = getDb();
        db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
        db.close();
      } catch (err) {
        console.error('删除任务记录失败:', err);
      }
    }
    return deleted;
  }

  subscribe(taskId: string, callback: (event: ProgressEvent) => void): () => void {
    const handler = (event: ProgressEvent) => callback(event);
    this.on(`progress:${taskId}`, handler);
    return () => this.off(`progress:${taskId}`, handler);
  }
}

const globalForStore = globalThis as typeof globalThis & { __taskStore?: TaskStore };
export const taskStore = globalForStore.__taskStore ?? (globalForStore.__taskStore = new TaskStore());
