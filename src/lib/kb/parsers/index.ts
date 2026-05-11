import type { KBSourceType } from '@/types/kb';
import { parseUrl, crawlSite } from './parseUrl';
import { parseDocx } from './parseDocx';
import { parsePdf } from './parsePdf';
import { parseCsv } from './parseCsv';
import { parseMd } from './parseMd';
import { parseFeishu } from './parseFeishu';
import { parseAudioImport } from './parseAudioImport';

export interface ParseResult {
  title?: string;
  text: string;
  rows?: string[]; // For CSV/Feishu: individual rows for per-row chunking
}

export async function parseDocument(
  sourceType: KBSourceType,
  input: { content?: string; filePath?: string; url?: string; taskId?: string; title?: string }
): Promise<ParseResult> {
  switch (sourceType) {
    case 'text':
      if (!input.content) throw new Error('文本内容为空');
      return { text: input.content, title: input.title };

    case 'url':
      if (!input.url) throw new Error('URL 为空');
      return parseUrl(input.url);

    case 'site':
      if (!input.url) throw new Error('URL 为空');
      return crawlSite(input.url);

    case 'upload_md':
      if (!input.filePath) throw new Error('文件路径为空');
      return { text: await parseMd(input.filePath) };

    case 'upload_docx':
      if (!input.filePath) throw new Error('文件路径为空');
      return { text: await parseDocx(input.filePath) };

    case 'upload_pdf':
      if (!input.filePath) throw new Error('文件路径为空');
      return { text: await parsePdf(input.filePath) };

    case 'upload_csv':
      if (!input.filePath) throw new Error('文件路径为空');
      return parseCsv(input.filePath);

    case 'feishu':
      if (!input.url) throw new Error('飞书链接为空');
      return parseFeishu(input.url);

    case 'audio_import':
      if (!input.taskId) throw new Error('任务 ID 为空');
      return parseAudioImport(input.taskId);

    default:
      throw new Error(`不支持的文档类型: ${sourceType}`);
  }
}
