import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';

export async function parseCsv(filePath: string): Promise<{ text: string; rows: string[] }> {
  const content = await fs.readFile(filePath, 'utf-8');
  const records: string[][] = parse(content, {
    skip_empty_lines: true,
    relax_column_count: true,
  });

  if (records.length < 2) throw new Error('CSV 内容为空或只有表头');

  const headers = records[0];
  const dataRows = records.slice(1);

  // Format each row as "header1: value1 | header2: value2"
  const rows = dataRows.map((row) =>
    headers.map((h, i) => `${h}: ${row[i] || ''}`).join(' | ')
  );

  const text = rows.join('\n');
  return { text, rows };
}
