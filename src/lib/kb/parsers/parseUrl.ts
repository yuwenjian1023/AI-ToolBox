import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// Site crawler page cap. Override with KB_CRAWL_MAX_PAGES for big doc sites.
const MAX_PAGES = Number(process.env.KB_CRAWL_MAX_PAGES) || 300;

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`抓取失败: ${response.status}`);
  return response.text();
}

/**
 * Improved text extraction: preserves structure, removes noise
 */
function extractText(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);

  // Remove all noise elements aggressively
  $(
    'script, style, link, meta, noscript, iframe, svg, ' +
    'nav, footer, header, aside, ' +
    '.sidebar, .nav, .footer, .header, .breadcrumb, .pagination, ' +
    '.ad, .advertisement, .banner, .cookie, ' +
    '.toc, .table-of-contents, ' +
    '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
    '[aria-hidden="true"], ' +
    'button, select, input, form'
  ).remove();

  const title = $('title').text().trim().split('|')[0].trim()
    || $('h1').first().text().trim()
    || '';

  // Try progressively broader content selectors
  const contentSelectors = [
    'article', 'main', '.markdown-body', '.doc-content', '.content-body',
    '.post-content', '.article-content', '.entry-content',
    '#content', '#main', '.content', '.post', '.article',
  ];

  let $content: ReturnType<typeof $> | null = null;
  for (const sel of contentSelectors) {
    const el = $(sel);
    if (el.length > 0 && el.text().trim().length > 200) {
      $content = el;
      break;
    }
  }

  if (!$content) {
    $content = $('body');
  }

  // Convert to structured text preserving headings and paragraphs
  const blocks: string[] = [];

  $content.find('h1, h2, h3, h4, h5, h6, p, li, td, th, pre, blockquote, dt, dd').each((_, el) => {
    const tag = (el as unknown as { tagName?: string }).tagName?.toLowerCase();
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text || text.length < 3) return;

    // Skip if it looks like navigation/UI text (very short, repeated patterns)
    if (text.length < 10 && /^(首页|登录|注册|关闭|展开|收起|更多|返回|上一页|下一页)$/.test(text)) return;

    if (tag === 'h1') blocks.push(`\n# ${text}\n`);
    else if (tag === 'h2') blocks.push(`\n## ${text}\n`);
    else if (tag === 'h3') blocks.push(`\n### ${text}\n`);
    else if (tag === 'h4' || tag === 'h5' || tag === 'h6') blocks.push(`\n#### ${text}\n`);
    else if (tag === 'li') blocks.push(`- ${text}`);
    else if (tag === 'pre') blocks.push(`\`\`\`\n${text}\n\`\`\``);
    else if (tag === 'blockquote') blocks.push(`> ${text}`);
    else blocks.push(text);
  });

  let text = blocks.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // If structured extraction got very little, fallback to full text
  if (text.length < 100) {
    text = $content.text().replace(/\s+/g, ' ').trim();
  }

  return { title, text };
}

function extractLinks(html: string, baseUrl: string, pathPrefix: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const links: Set<string> = new Set();

  $('a[href]').each((_, el) => {
    try {
      const href = $(el).attr('href');
      if (!href) return;
      const resolved = new URL(href, baseUrl);
      if (resolved.origin !== base.origin) return;
      // Stay within the rootUrl's path subtree — avoids drifting into
      // forum/blog/other SDK docs when crawling e.g. /docs/sdk/taptap-login/
      if (!resolved.pathname.startsWith(pathPrefix)) return;
      if (resolved.hash) resolved.hash = '';
      const path = resolved.pathname;
      if (/\.(png|jpg|jpeg|gif|svg|pdf|zip|css|js|json|xml|ico|woff|ttf)$/i.test(path)) return;
      links.add(resolved.toString());
    } catch { /* invalid URL */ }
  });

  return Array.from(links);
}

export async function parseUrl(url: string): Promise<{ title: string; text: string }> {
  const html = await fetchPage(url);
  const { title, text } = extractText(html);
  if (!text) throw new Error('未能从网页中提取到内容');
  return { title: title || url, text };
}

export async function crawlSite(
  rootUrl: string,
  onProgress?: (crawled: number, found: number) => void
): Promise<{ title: string; text: string; pageCount: number }> {
  const visited = new Set<string>();
  const queue: string[] = [rootUrl];
  const allTexts: string[] = [];
  let siteTitle = '';

  // Constrain crawl to the rootUrl's path subtree.
  // /docs/sdk/taptap-login/guide/ → only follows links under /docs/sdk/taptap-login/
  // /docs/sdk/                   → follows the entire SDK doc tree
  const rootPath = new URL(rootUrl).pathname;
  const pathPrefix = rootPath.endsWith('/') ? rootPath : rootPath.replace(/\/[^/]*$/, '/');

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const html = await fetchPage(url);
      const { title, text } = extractText(html);

      if (!siteTitle && title) siteTitle = title;
      if (text && text.length > 100) {
        // Include source URL for each page for better traceability
        allTexts.push(`# ${title || url}\n来源: ${url}\n\n${text}`);
      }

      const links = extractLinks(html, url, pathPrefix);
      for (const link of links) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link);
        }
      }

      if (onProgress) onProgress(visited.size, visited.size + queue.length);
      await new Promise((r) => setTimeout(r, 300));
    } catch {
      // Skip failed pages
    }
  }

  if (allTexts.length === 0) {
    throw new Error('未能从站点中提取到任何内容');
  }

  return {
    title: siteTitle || rootUrl,
    text: allTexts.join('\n\n---\n\n'),
    pageCount: allTexts.length,
  };
}
