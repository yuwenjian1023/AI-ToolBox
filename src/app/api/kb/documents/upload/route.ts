export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { kbStore } from '@/lib/kb/store';
import { runKBPipeline } from '@/lib/kb/pipeline';
import { getInviteCode } from '@/lib/auth';
import type { KBSourceType } from '@/types/kb';

const TEMP_DIR = process.env.TEMP_DIR || './temp';
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

const EXT_MAP: Record<string, KBSourceType> = {
  '.md': 'upload_md',
  '.txt': 'upload_md',
  '.docx': 'upload_docx',
  '.pdf': 'upload_pdf',
  '.csv': 'upload_csv',
};

export async function POST(request: Request) {
  try {
    const inviteCode = getInviteCode(request);
    if (!inviteCode) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '未选择文件' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '文件大小超过 20MB 限制' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    const sourceType = EXT_MAP[ext];

    if (!sourceType) {
      return NextResponse.json({ error: `不支持的文件格式: ${ext}，支持 .md .txt .docx .pdf .csv` }, { status: 400 });
    }

    // Save to temp
    await fs.mkdir(TEMP_DIR, { recursive: true });
    const tempPath = path.resolve(TEMP_DIR, `kb_${Date.now()}_${file.name}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempPath, buffer);

    // Create document record
    const title = file.name.replace(ext, '');
    const doc = kbStore.createDocument(title, sourceType, file.name, 'guide', inviteCode);

    // Start pipeline
    runKBPipeline(doc.id, { sourceType, title, filePath: tempPath }).catch(() => {});

    return NextResponse.json({ docId: doc.id, status: doc.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
