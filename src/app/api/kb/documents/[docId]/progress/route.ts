export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { kbStore } from '@/lib/kb/store';
import { getInviteCode } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const inviteCode = getInviteCode(request);
  if (!inviteCode) {
    return new Response('未登录', { status: 401 });
  }

  const { docId } = await params;
  const doc = kbStore.getDocument(docId);

  if (!doc || doc.inviteCode !== inviteCode) {
    return new Response('文档不存在', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Flush HTTP buffer with 2KB padding comment so subsequent SSE events stream immediately
      controller.enqueue(encoder.encode(`: ${' '.repeat(2048)}\n\n`));

      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream closed */ }
      };

      // Send current state
      send({ docId, status: doc.status, progress: doc.status === 'ready' ? 100 : 0, message: '' });

      if (doc.status === 'ready' || doc.status === 'failed') {
        controller.close();
        return;
      }

      const unsubscribe = kbStore.subscribe(docId, (event) => {
        send(event);
        if (event.status === 'ready' || event.status === 'failed') {
          setTimeout(() => {
            unsubscribe();
            try { controller.close(); } catch { /* already closed */ }
          }, 100);
        }
      });

      request.signal.addEventListener('abort', () => {
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
