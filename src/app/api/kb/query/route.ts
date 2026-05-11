import { NextResponse } from 'next/server';
import { queryKnowledgeBase } from '@/lib/kb/rag';
import { getInviteCode } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const inviteCode = getInviteCode(request);
    if (!inviteCode) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { question, topK } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: '请输入问题' }, { status: 400 });
    }

    const result = await queryKnowledgeBase(question.trim(), topK || 5, inviteCode);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
