export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { taskStore } from '@/lib/taskStore';
import { getInviteCode } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const inviteCode = getInviteCode(request);
  if (!inviteCode) {
    return new Response('未登录', { status: 401 });
  }

  const { taskId } = await params;
  const task = taskStore.getTask(taskId);

  if (!task || task.inviteCode !== inviteCode) {
    return new Response('Task not found', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Flush HTTP buffer with 2KB padding comment so subsequent SSE events stream immediately
      controller.enqueue(encoder.encode(`: ${' '.repeat(2048)}\n\n`));

      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream may be closed
        }
      };

      // Send current state immediately
      send({
        taskId: task.id,
        status: task.status,
        progress: task.progress,
        message: task.statusMessage,
      });

      // If already terminal, close
      if (task.status === 'completed' || task.status === 'failed') {
        controller.close();
        return;
      }

      // Subscribe to updates
      const unsubscribe = taskStore.subscribe(taskId, (event) => {
        send(event);
        if (event.status === 'completed' || event.status === 'failed') {
          setTimeout(() => {
            unsubscribe();
            try { controller.close(); } catch { /* already closed */ }
          }, 100);
        }
      });

      // Cleanup on client disconnect
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
