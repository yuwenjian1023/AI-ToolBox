import { randomUUID } from 'crypto';
import { kbStore } from './store';
import { parseDocument } from './parsers';
import { chunkText, chunkRows } from './chunker';
import { embedTexts } from './embedding';
import type { KBSourceType } from '@/types/kb';

export interface PipelineInput {
  sourceType: KBSourceType;
  title?: string;
  content?: string;
  filePath?: string;
  url?: string;
  taskId?: string; // for audio_import
}

// Pull the source URL for a chunk so the LLM can cite it.
// - 'url': the whole document is one URL → all chunks share input.url
// - 'site': crawlSite prepends "来源: <url>" per page → grep it out per chunk
// - others: no per-chunk URL
function extractChunkSourceUrl(sourceType: KBSourceType, chunkContent: string, inputUrl?: string): string | undefined {
  if (sourceType === 'url') return inputUrl || undefined;
  if (sourceType === 'site') {
    const m = chunkContent.match(/来源:\s*(https?:\/\/\S+)/);
    return m ? m[1] : undefined;
  }
  return undefined;
}

export async function runKBPipeline(docId: string, input: PipelineInput) {
  try {
    // ===== 1. Parse =====
    kbStore.updateDocument(docId, { status: 'processing' });
    kbStore.updateProgress(docId, 'processing', 10, '正在解析文档...');

    const parsed = await parseDocument(input.sourceType, {
      content: input.content,
      filePath: input.filePath,
      url: input.url,
      taskId: input.taskId,
      title: input.title,
    });

    if (parsed.title) {
      kbStore.updateDocument(docId, { title: parsed.title });
    }
    kbStore.updateDocument(docId, { contentRaw: parsed.text });
    kbStore.updateProgress(docId, 'processing', 30, '文档解析完成，正在分片...');

    // ===== 2. Chunk =====
    let chunks: string[];
    if (parsed.rows && parsed.rows.length > 0) {
      // CSV/Feishu: per-row chunking
      chunks = chunkRows(parsed.rows);
    } else {
      chunks = chunkText(parsed.text);
    }

    if (chunks.length === 0) {
      throw new Error('文档分片结果为空');
    }

    kbStore.updateProgress(docId, 'processing', 50, `分片完成（${chunks.length} 个片段），正在向量化...`);

    // ===== 3. Embed =====
    const embeddings = await embedTexts(chunks, (done, total) => {
      const pct = 50 + Math.round((done / total) * 40);
      kbStore.updateProgress(docId, 'processing', pct, `向量化中 ${done}/${total}...`);
    });

    // ===== 4. Store chunks =====
    kbStore.updateProgress(docId, 'processing', 95, '正在保存...');

    const chunkRecords = chunks.map((content, i) => ({
      id: randomUUID().slice(0, 8),
      docId,
      chunkIndex: i,
      content,
      embedding: embeddings[i],
      tokenCount: Math.ceil(content.length / 2), // rough estimate
      sourceUrl: extractChunkSourceUrl(input.sourceType, content, input.url),
    }));

    kbStore.insertChunks(chunkRecords);
    kbStore.updateDocument(docId, {
      chunkCount: chunks.length,
      status: 'ready',
    });
    kbStore.updateProgress(docId, 'ready', 100, '处理完成');

    // Cleanup temp file if it was an upload
    if (input.filePath) {
      try {
        const fs = await import('fs/promises');
        await fs.unlink(input.filePath);
      } catch { /* ignore */ }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    kbStore.updateDocument(docId, { status: 'failed', error: message });
    kbStore.updateProgress(docId, 'failed', 0, `处理失败: ${message}`);
  }
}
