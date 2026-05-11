import fs from 'fs/promises';

export async function parseMd(filePath: string): Promise<string> {
  const text = await fs.readFile(filePath, 'utf-8');
  if (!text.trim()) throw new Error('Markdown 文件内容为空');
  return text.trim();
}
