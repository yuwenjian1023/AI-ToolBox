import { NextResponse } from 'next/server';
import { kbStore } from '@/lib/kb/store';
import { runKBPipeline } from '@/lib/kb/pipeline';
import { getInviteCode } from '@/lib/auth';
import type { KBSourceType, KBCategory } from '@/types/kb';

// GET: list all documents
export async function GET(request: Request) {
  const inviteCode = getInviteCode(request);
  if (!inviteCode) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const docs = kbStore.getAllDocuments(inviteCode);
  return NextResponse.json(docs);
}

// Auto-categorize by source type so retrieval can boost the right docs.
// Caller can override via the optional `category` field in request body.
function defaultCategoryFor(sourceType: KBSourceType): KBCategory {
  if (sourceType === 'feishu') return 'faq';
  if (sourceType === 'url' || sourceType === 'site') return 'guide';
  return 'guide';
}

// POST: create document from text/url/feishu/audio_import
export async function POST(request: Request) {
  try {
    const inviteCode = getInviteCode(request);
    if (!inviteCode) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { sourceType, title, content, url, taskId, category } = body as {
      sourceType: KBSourceType;
      title?: string;
      content?: string;
      url?: string;
      taskId?: string;
      category?: KBCategory;
    };

    if (!sourceType) {
      return NextResponse.json({ error: '缺少 sourceType' }, { status: 400 });
    }

    const docTitle = title || url || '未命名文档';
    const sourceRef = url || taskId || '';
    const docCategory: KBCategory = category || defaultCategoryFor(sourceType);
    const doc = kbStore.createDocument(docTitle, sourceType, sourceRef, docCategory, inviteCode);

    // Start pipeline asynchronously
    runKBPipeline(doc.id, { sourceType, title: docTitle, content, url, taskId }).catch(() => {});

    return NextResponse.json({ docId: doc.id, status: doc.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
