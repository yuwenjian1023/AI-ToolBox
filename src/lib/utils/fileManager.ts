import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import type { Task } from '@/types';

const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';
const TEMP_DIR = process.env.TEMP_DIR || './temp';

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
}

export function getTempPath(taskId: string, ext: string = 'mp3'): string {
  return path.resolve(TEMP_DIR, `${taskId}.${ext}`);
}

export function getOutputPath(task: Task): string {
  const date = new Date().toISOString().slice(0, 10);
  const titlePart = sanitizeFilename(task.title);
  const filename = `${date}_${titlePart}_${task.id}.md`;
  return path.resolve(OUTPUT_DIR, filename);
}

export async function saveMarkdownFile(task: Task): Promise<string> {
  const outputPath = getOutputPath(task);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, task.markdown || '', 'utf-8');
  return outputPath;
}

export async function cleanupTempFile(filePath?: string) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

export async function readFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

export async function renderMermaidToFile(
  mermaidCode: string,
  task: Task
): Promise<{ pngPath: string }> {
  const date = new Date().toISOString().slice(0, 10);
  const titlePart = sanitizeFilename(task.title);
  const baseName = `${date}_${titlePart}_${task.id}_mindmap`;
  const pngPath = path.resolve(OUTPUT_DIR, `${baseName}.png`);

  // Write temp .mmd file
  const mmdPath = path.resolve(TEMP_DIR, `${task.id}.mmd`);
  await fs.writeFile(mmdPath, mermaidCode, 'utf-8');

  // Find mmdc binary
  const mmdcPath = path.resolve('node_modules', '.bin', 'mmdc');

  // Render PNG
  await runMmdc(mmdcPath, mmdPath, pngPath, 'png');

  // Cleanup temp .mmd
  await cleanupTempFile(mmdPath);

  return { pngPath };
}

function runMmdc(
  mmdcPath: string,
  inputPath: string,
  outputPath: string,
  format: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(mmdcPath, [
      '-i', inputPath,
      '-o', outputPath,
      '-e', format,
      '-b', 'white',
      '-s', '2',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`mmdc 渲染 ${format} 失败: ${stderr}`));
      } else {
        resolve();
      }
    });

    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`mmdc 渲染 ${format} 超时`));
    }, 60000);
  });
}
