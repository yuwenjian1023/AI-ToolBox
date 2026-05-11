import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import type { KBDocument, KBSourceType, KBDocumentStatus, KBCategory, KBProgressEvent } from '@/types/kb';

const DB_PATH = path.resolve(process.env.OUTPUT_DIR || './output', 'kb.db');

function openDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_ref TEXT NOT NULL DEFAULT '',
      content_raw TEXT NOT NULL DEFAULT '',
      chunk_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      category TEXT NOT NULL DEFAULT 'guide',
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT,
      token_count INTEGER,
      source_url TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(doc_id);
  `);

  // Backward-compatible migrations: add columns if missing on existing DBs
  const tryAlter = (sql: string) => {
    try { db.exec(sql); } catch { /* column already exists */ }
  };
  tryAlter(`ALTER TABLE documents ADD COLUMN category TEXT NOT NULL DEFAULT 'guide'`);
  tryAlter(`ALTER TABLE chunks ADD COLUMN source_url TEXT`);
  tryAlter(`ALTER TABLE documents ADD COLUMN invite_code TEXT NOT NULL DEFAULT ''`);

  return db;
}

class KBStore extends EventEmitter {
  private db: Database.Database | null = null;

  private getDb(): Database.Database {
    if (!this.db) {
      this.db = openDb();
      // Mark interrupted processing/pending documents as failed on startup
      this.db.prepare(
        `UPDATE documents SET status = 'failed', error = '服务重启，处理中断，请重新添加', updated_at = ? WHERE status IN ('processing', 'pending')`
      ).run(new Date().toISOString());
    }
    return this.db;
  }

  createDocument(title: string, sourceType: KBSourceType, sourceRef: string = '', category: KBCategory = 'guide', inviteCode: string = ''): KBDocument {
    const now = new Date().toISOString();
    const doc: KBDocument = {
      id: randomUUID().slice(0, 8),
      title,
      sourceType,
      sourceRef,
      contentRaw: '',
      chunkCount: 0,
      status: 'pending',
      category,
      inviteCode,
      createdAt: now,
      updatedAt: now,
    };
    this.getDb().prepare(`
      INSERT INTO documents (id, title, source_type, source_ref, content_raw, chunk_count, status, category, invite_code, created_at, updated_at)
      VALUES (?, ?, ?, ?, '', 0, 'pending', ?, ?, ?, ?)
    `).run(doc.id, doc.title, doc.sourceType, doc.sourceRef, doc.category, inviteCode, now, now);
    return doc;
  }

  getDocument(docId: string): KBDocument | undefined {
    const row = this.getDb().prepare('SELECT * FROM documents WHERE id = ?').get(docId) as Record<string, unknown> | undefined;
    return row ? this.rowToDocument(row) : undefined;
  }

  getAllDocuments(inviteCode?: string): KBDocument[] {
    if (inviteCode) {
      const rows = this.getDb().prepare('SELECT * FROM documents WHERE invite_code = ? ORDER BY created_at DESC').all(inviteCode) as Record<string, unknown>[];
      return rows.map((r) => this.rowToDocument(r));
    }
    const rows = this.getDb().prepare('SELECT * FROM documents ORDER BY created_at DESC').all() as Record<string, unknown>[];
    return rows.map((r) => this.rowToDocument(r));
  }

  updateDocument(docId: string, updates: Partial<Pick<KBDocument, 'title' | 'contentRaw' | 'chunkCount' | 'status' | 'error'>>) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (updates.title !== undefined) { sets.push('title = ?'); vals.push(updates.title); }
    if (updates.contentRaw !== undefined) { sets.push('content_raw = ?'); vals.push(updates.contentRaw); }
    if (updates.chunkCount !== undefined) { sets.push('chunk_count = ?'); vals.push(updates.chunkCount); }
    if (updates.status !== undefined) { sets.push('status = ?'); vals.push(updates.status); }
    if (updates.error !== undefined) { sets.push('error = ?'); vals.push(updates.error); }
    sets.push('updated_at = ?');
    vals.push(new Date().toISOString());
    vals.push(docId);
    this.getDb().prepare(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  deleteDocument(docId: string): boolean {
    const result = this.getDb().prepare('DELETE FROM documents WHERE id = ?').run(docId);
    if (result.changes > 0) this.embeddingCache.clear();
    return result.changes > 0;
  }

  // Embedding cache keyed by inviteCode for data isolation
  private embeddingCache: Map<string, Array<{ id: string; docId: string; content: string; embedding: number[]; category: KBCategory; sourceUrl?: string }>> = new Map();

  // Chunks
  insertChunks(chunks: Array<{ id: string; docId: string; chunkIndex: number; content: string; embedding: number[]; tokenCount: number; sourceUrl?: string }>) {
    this.embeddingCache.clear();
    const db = this.getDb();
    const now = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO chunks (id, doc_id, chunk_index, content, embedding, token_count, source_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction(() => {
      for (const c of chunks) {
        insert.run(c.id, c.docId, c.chunkIndex, c.content, JSON.stringify(c.embedding), c.tokenCount, c.sourceUrl ?? null, now);
      }
    });
    tx();
  }

  getAllChunksWithEmbeddings(inviteCode?: string): Array<{ id: string; docId: string; content: string; embedding: number[]; category: KBCategory; sourceUrl?: string }> {
    const cacheKey = inviteCode || '__all__';
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) return cached;

    let rows;
    if (inviteCode) {
      rows = this.getDb().prepare(`
        SELECT c.id, c.doc_id, c.content, c.embedding, c.source_url, d.category
        FROM chunks c
        JOIN documents d ON c.doc_id = d.id
        WHERE d.status = 'ready' AND c.embedding IS NOT NULL AND d.invite_code = ?
      `).all(inviteCode) as Array<{ id: string; doc_id: string; content: string; embedding: string; source_url: string | null; category: string | null }>;
    } else {
      rows = this.getDb().prepare(`
        SELECT c.id, c.doc_id, c.content, c.embedding, c.source_url, d.category
        FROM chunks c
        JOIN documents d ON c.doc_id = d.id
        WHERE d.status = 'ready' AND c.embedding IS NOT NULL
      `).all() as Array<{ id: string; doc_id: string; content: string; embedding: string; source_url: string | null; category: string | null }>;
    }

    const result = rows.map((r) => ({
      id: r.id,
      docId: r.doc_id,
      content: r.content,
      embedding: JSON.parse(r.embedding),
      category: (r.category as KBCategory) || 'guide',
      sourceUrl: r.source_url || undefined,
    }));
    this.embeddingCache.set(cacheKey, result);
    return result;
  }

  getDocumentTitleMap(inviteCode?: string): Record<string, string> {
    let rows;
    if (inviteCode) {
      rows = this.getDb().prepare('SELECT id, title FROM documents WHERE status = ? AND invite_code = ?').all('ready', inviteCode) as Array<{ id: string; title: string }>;
    } else {
      rows = this.getDb().prepare('SELECT id, title FROM documents WHERE status = ?').all('ready') as Array<{ id: string; title: string }>;
    }
    const map: Record<string, string> = {};
    for (const r of rows) map[r.id] = r.title;
    return map;
  }

  getDocChunksOrdered(docId: string, limit: number): Array<{ content: string; sourceUrl?: string }> {
    const rows = this.getDb().prepare(`
      SELECT content, source_url
      FROM chunks
      WHERE doc_id = ?
      ORDER BY chunk_index ASC
      LIMIT ?
    `).all(docId, limit) as Array<{ content: string; source_url: string | null }>;
    return rows.map((r) => ({ content: r.content, sourceUrl: r.source_url || undefined }));
  }

  getChunksBySourceUrl(sourceUrl: string, limit: number): Array<{ content: string }> {
    const rows = this.getDb().prepare(`
      SELECT content
      FROM chunks
      WHERE source_url = ?
      ORDER BY chunk_index ASC
      LIMIT ?
    `).all(sourceUrl, limit) as Array<{ content: string }>;
    return rows.map((r) => ({ content: r.content }));
  }

  // Progress events
  updateProgress(docId: string, status: KBDocumentStatus, progress: number, message: string) {
    const event: KBProgressEvent = { docId, status, progress, message };
    this.emit(`progress:${docId}`, event);
  }

  subscribe(docId: string, callback: (event: KBProgressEvent) => void): () => void {
    const handler = (event: KBProgressEvent) => callback(event);
    this.on(`progress:${docId}`, handler);
    return () => this.off(`progress:${docId}`, handler);
  }

  private rowToDocument(row: Record<string, unknown>): KBDocument {
    return {
      id: row.id as string,
      title: row.title as string,
      sourceType: row.source_type as KBSourceType,
      sourceRef: row.source_ref as string,
      contentRaw: row.content_raw as string,
      chunkCount: row.chunk_count as number,
      status: row.status as KBDocumentStatus,
      category: ((row.category as KBCategory) || 'guide'),
      inviteCode: (row.invite_code as string) || undefined,
      error: (row.error as string) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

const globalForKB = globalThis as typeof globalThis & { __kbStore?: KBStore };
export const kbStore = globalForKB.__kbStore ?? (globalForKB.__kbStore = new KBStore());
