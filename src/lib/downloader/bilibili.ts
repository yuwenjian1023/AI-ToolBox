import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

const TEMP_DIR = process.env.TEMP_DIR || './temp';

export interface DownloadResult {
  audioPath: string;
  title: string;
}

export async function downloadBilibili(
  url: string,
  taskId: string,
  onProgress?: (percent: number) => void
): Promise<DownloadResult> {
  const outputTemplate = path.resolve(TEMP_DIR, `${taskId}.%(ext)s`);

  // First get the title
  const title = await getBilibiliTitle(url);

  return new Promise((resolve, reject) => {
    const args = [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', outputTemplate,
      '--no-playlist',
      '--no-warnings',
      url,
    ];

    const proc = spawn('yt-dlp', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      const line = data.toString();
      // Parse progress: [download]  45.2% of 12.34MiB
      const match = line.match(/\[download\]\s+([\d.]+)%/);
      if (match && onProgress) {
        onProgress(Math.round(parseFloat(match[1])));
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp 下载失败 (code ${code}): ${stderr}`));
        return;
      }
      const audioPath = path.resolve(TEMP_DIR, `${taskId}.mp3`);
      try {
        await fs.access(audioPath);
        resolve({ audioPath, title });
      } catch {
        // yt-dlp might output with different extension
        const files = await fs.readdir(path.resolve(TEMP_DIR));
        const match = files.find((f) => f.startsWith(taskId));
        if (match) {
          resolve({ audioPath: path.resolve(TEMP_DIR, match), title });
        } else {
          reject(new Error('下载完成但未找到音频文件'));
        }
      }
    });

    // Timeout after 10 minutes
    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('下载超时（10分钟）'));
    }, 10 * 60 * 1000);
  });
}

async function getBilibiliTitle(url: string): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn('yt-dlp', ['--get-title', '--no-warnings', url]);
    let title = '';
    proc.stdout.on('data', (data: Buffer) => {
      title += data.toString().trim();
    });
    proc.on('close', () => {
      resolve(title || '未知视频');
    });
    setTimeout(() => {
      proc.kill('SIGTERM');
      resolve('未知视频');
    }, 30000);
  });
}
