import mammoth from 'mammoth';

export async function parseDocx(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value.trim();
  if (!text) throw new Error('Word 文档内容为空');
  return text;
}
