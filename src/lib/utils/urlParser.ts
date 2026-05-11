import type { LinkSource } from '@/types';

export interface ParsedUrl {
  source: LinkSource;
  id: string;
  originalUrl: string;
}

export function parseUrl(url: string): ParsedUrl {
  const trimmed = url.trim();

  // Bilibili: bilibili.com/video/BVxxx or b23.tv/xxx
  const biliMatch = trimmed.match(/bilibili\.com\/video\/(BV[\w]+)/);
  if (biliMatch) {
    return { source: 'bilibili', id: biliMatch[1], originalUrl: trimmed };
  }
  if (/b23\.tv\//.test(trimmed)) {
    return { source: 'bilibili', id: '', originalUrl: trimmed };
  }

  // 小宇宙: xiaoyuzhoufm.com/episode/xxx
  const xyuzMatch = trimmed.match(/xiaoyuzhoufm\.com\/episode\/([\w]+)/);
  if (xyuzMatch) {
    return { source: 'xiaoyuzhou', id: xyuzMatch[1], originalUrl: trimmed };
  }

  throw new Error('不支持的链接格式。请提供 Bilibili 视频链接或小宇宙播客链接。');
}
