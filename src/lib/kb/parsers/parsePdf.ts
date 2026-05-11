import fs from 'fs/promises';
import { PDFParse } from 'pdf-parse';

export async function parsePdf(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  const text = result.text.trim();
  if (!text) throw new Error('PDF 文档内容为空');
  return text;
}
