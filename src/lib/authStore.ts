import { randomBytes } from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(process.env.OUTPUT_DIR || './output', 'auth.db');

interface InviteCode {
  code: string;
  label: string;
  createdAt: string;
  usedAt: string | null;
}

function openDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      invite_code TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (invite_code, key)
    );
  `);
  return db;
}

function generateCode(): string {
  const hex = randomBytes(4).toString('hex').toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

class AuthStore {
  private db: Database.Database | null = null;
  private seeded = false;

  private getDb(): Database.Database {
    if (!this.db) {
      this.db = openDb();
      this.seed();
    }
    return this.db;
  }

  private seed() {
    if (this.seeded) return;
    this.seeded = true;
    const db = this.db!;
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM invite_codes').get() as { cnt: number }).cnt;
    if (count > 0) return;

    const now = new Date().toISOString();
    const insert = db.prepare('INSERT INTO invite_codes (code, label, created_at) VALUES (?, ?, ?)');
    const codes: string[] = [];

    const envCode = process.env.INVITE_CODE?.trim();
    if (envCode) {
      insert.run(envCode, 'env', now);
      codes.push(envCode);
      console.log(`\n========== 邀请码 ==========`);
      console.log(`  ${envCode}`);
      console.log('=============================\n');
    } else {
      const tx = db.transaction(() => {
        for (let i = 0; i < 10; i++) {
          const code = generateCode();
          insert.run(code, '', now);
          codes.push(code);
        }
      });
      tx();

      console.log('\n========== 邀请码列表 ==========');
      codes.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
      console.log('================================\n');
    }
  }

  validateCode(code: string): boolean {
    const normalized = code.trim().toUpperCase();
    const row = this.getDb().prepare('SELECT code FROM invite_codes WHERE code = ?').get(normalized);
    if (row) return true;
    // fallback: check INVITE_CODE env var (for codes set after db was seeded)
    return normalized === process.env.INVITE_CODE?.trim().toUpperCase();
  }

  markUsed(code: string) {
    const normalized = code.trim().toUpperCase();
    this.getDb().prepare('UPDATE invite_codes SET used_at = ? WHERE code = ? AND used_at IS NULL')
      .run(new Date().toISOString(), normalized);
  }

  getSetting(inviteCode: string, key: string): string | null {
    const row = this.getDb().prepare('SELECT value FROM user_settings WHERE invite_code = ? AND key = ?')
      .get(inviteCode, key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setSetting(inviteCode: string, key: string, value: string) {
    this.getDb().prepare('INSERT OR REPLACE INTO user_settings (invite_code, key, value) VALUES (?, ?, ?)')
      .run(inviteCode, key, value);
  }

  getAllCodes(): InviteCode[] {
    const rows = this.getDb().prepare('SELECT * FROM invite_codes ORDER BY created_at').all() as Array<{
      code: string; label: string; created_at: string; used_at: string | null;
    }>;
    return rows.map(r => ({
      code: r.code,
      label: r.label,
      createdAt: r.created_at,
      usedAt: r.used_at,
    }));
  }
}

const globalForAuth = globalThis as typeof globalThis & { __authStore?: AuthStore };
export const authStore = globalForAuth.__authStore ?? (globalForAuth.__authStore = new AuthStore());
