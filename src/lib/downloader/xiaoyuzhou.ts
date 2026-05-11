import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const TEMP_DIR = process.env.TEMP_DIR || './temp';

export interface DownloadResult {
  audioPath: string;
  title: string;
}

interface EpisodeInfo {
  audioUrl: string;
  title: string;
  duration?: number;
}

async function fetchEpisodeInfo(url: string): Promise<EpisodeInfo> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`获取小宇宙页面失败: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Method 1: Parse __NEXT_DATA__
  const nextDataScript = $('#__NEXT_DATA__').text();
  if (nextDataScript) {
    try {
      const nextData = JSON.parse(nextDataScript);
      const episode = nextData?.props?.pageProps?.episode;
      if (episode?.enclosure?.url) {
        return {
          audioUrl: episode.enclosure.url,
          title: episode.title || '未知节目',
          duration: episode.duration,
        };
      }
    } catch {
      // fallback to method 2
    }
  }

  // Method 2: Parse og:audio meta tag
  const audioUrl = $('meta[property="og:audio"]').attr('content');
  const title = $('meta[property="og:title"]').attr('content') || '未知节目';

  if (audioUrl) {
    return { audioUrl, title };
  }

  // Method 3: Regex search for audio URL
  const urlMatch = html.match(/https?:\/\/media\.xyzcdn\.net\/[^\s"']+\.m(?:p3|4a)/);
  if (urlMatch) {
    return { audioUrl: urlMatch[0], title };
  }

  throw new Error('无法从小宇宙页面提取音频链接');
}

export async function downloadXiaoyuzhou(
  url: string,
  taskId: string,
  onProgress?: (percent: number) => void
): Promise<DownloadResult> {
  const info = await fetchEpisodeInfo(url);

  // Determine file extension from URL
  const ext = info.audioUrl.includes('.m4a') ? 'm4a' : 'mp3';
  const audioPath = path.resolve(TEMP_DIR, `${taskId}.${ext}`);

  // Download audio file
  const response = await fetch(info.audioUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`下载音频失败: ${response.status}`);
  }

  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  let downloaded = 0;

  const fileStream = fs.createWriteStream(audioPath);
  const reader = response.body.getReader();

  const nodeStream = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
        return;
      }
      downloaded += value.length;
      if (contentLength > 0 && onProgress) {
        onProgress(Math.round((downloaded / contentLength) * 100));
      }
      this.push(Buffer.from(value));
    },
  });

  await pipeline(nodeStream, fileStream);

  return { audioPath, title: info.title };
}
