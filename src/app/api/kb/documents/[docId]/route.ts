import { NextResponse } from 'next/server';
import { kbStore } from '@/lib/kb/store';
import { getInviteCode } from '@/lib/auth';

// GET: document detail
export async function GET(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const inviteCode = getInviteCode(request);
  if (!inviteCode) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { docId } = await params;
  const doc = kbStore.getDocument(docId);
  if (!doc || doc.inviteCode !== inviteCode) {
    return NextResponse.json({ error: '文档不存在' }, { status: 404 });
  }
  return NextResponse.json(doc);
}

// DELETE: remove document and chunks
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const inviteCode = getInviteCode(request);
  if (!inviteCode) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { docId } = await params;
  const doc = kbStore.getDocument(docId);
  if (!doc || doc.inviteCode !== inviteCode) {
    return NextResponse.json({ error: '文档不存在' }, { status: 404 });
  }

  kbStore.deleteDocument(docId);
  return NextResponse.json({ success: true });
}
