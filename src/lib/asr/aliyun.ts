import OSS from 'ali-oss';
import type { ASRResult, ASRSentence } from '@/types';

// ===== OSS =====

function getOSSClient(): OSS {
  return new OSS({
    region: process.env.OSS_REGION || 'oss-cn-beijing',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || '',
  });
}

export async function uploadToOSS(localPath: string, taskId: string): Promise<string> {
  const client = getOSSClient();
  const ext = localPath.split('.').pop() || 'mp3';
  const ossKey = `audio-transcribe/${taskId}.${ext}`;

  await client.put(ossKey, localPath);

  // Generate a signed URL valid for 2 hours
  const signedUrl = client.signatureUrl(ossKey, { expires: 7200 });
  return signedUrl;
}

export async function deleteFromOSS(taskId: string) {
  try {
    const client = getOSSClient();
    for (const ext of ['mp3', 'm4a', 'wav']) {
      try {
        await client.delete(`audio-transcribe/${taskId}.${ext}`);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

// ===== Generated files OSS =====

export async function uploadGeneratedFile(localPath: string, ossKey: string): Promise<void> {
  const client = getOSSClient();
  await client.put(ossKey, localPath);
}

export function getFileUrl(ossKey: string): string {
  const client = getOSSClient();
  return client.signatureUrl(ossKey, { expires: 604800 }); // 7 days
}

export async function deleteGeneratedFiles(taskId: string) {
  try {
    const client = getOSSClient();
    for (const ext of ['md', 'xmind', 'png']) {
      try {
        await client.delete(`generated/${taskId}/${taskId}.${ext}`);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

// ===== Retry helper =====

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 3000): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      console.error(`ASR 重试 ${i + 1}/${retries}:`, err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

// ===== DashScope ASR =====

const DASHSCOPE_API = 'https://dashscope.aliyuncs.com/api/v1';

interface DashScopeTaskResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    message?: string;
    results?: Array<{
      transcription_url: string;
    }>;
  };
}

export async function submitASRTask(audioUrl: string): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY 未配置');

  const response = await fetch(
    `${DASHSCOPE_API}/services/audio/asr/transcription`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: 'paraformer-v2',
        input: {
          file_urls: [audioUrl],
        },
        parameters: {
          language_hints: ['zh', 'en'],
          diarization_enabled: true,
          timestamp_enabled: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`提交 ASR 任务失败: ${response.status} ${body}`);
  }

  const data: DashScopeTaskResponse = await response.json();
  return data.output.task_id;
}

export async function pollASRResult(
  asrTaskId: string,
  onProgress?: (percent: number) => void
): Promise<ASRResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY 未配置');

  const maxAttempts = 180; // 15 minutes max
  const interval = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${DASHSCOPE_API}/tasks/${asrTaskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`查询 ASR 任务状态失败: ${response.status}`);
    }

    const data: DashScopeTaskResponse = await response.json();
    const { task_status } = data.output;

    if (task_status === 'SUCCEEDED') {
      const transcriptionUrl = data.output.results?.[0]?.transcription_url;
      if (!transcriptionUrl) {
        throw new Error('ASR 成功但未返回转录结果 URL');
      }

      const transcription = await fetch(transcriptionUrl).then((r) => r.json());
      return parseTranscription(transcription);
    }

    if (task_status === 'FAILED') {
      throw new Error(`语音识别失败: ${data.output.message || '未知错误'}`);
    }

    // Still running
    if (onProgress) {
      onProgress(Math.min(90, Math.round((i / maxAttempts) * 100)));
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('语音识别超时（超过15分钟）');
}

function parseTranscription(data: Record<string, unknown>): ASRResult {
  const transcripts = (data as { transcripts?: Array<{ text?: string; sentences?: Array<{ text: string; begin_time: number; end_time: number; speaker_id?: number }> }> }).transcripts;
  if (!transcripts || transcripts.length === 0) {
    throw new Error('转录结果为空');
  }

  const transcript = transcripts[0];
  const fullText = transcript.text || '';
  const sentences: ASRSentence[] = (transcript.sentences || []).map((s) => ({
    text: s.text,
    beginTime: s.begin_time,
    endTime: s.end_time,
    speakerId: s.speaker_id,
  }));

  return { fullText, sentences };
}

export async function transcribeAudio(
  audioUrl: string,
  onProgress?: (percent: number) => void
): Promise<ASRResult> {
  // submitASRTask is retried; pollASRResult has its own internal retry via polling
  const asrTaskId = await withRetry(() => submitASRTask(audioUrl));
  return pollASRResult(asrTaskId, onProgress);
}
