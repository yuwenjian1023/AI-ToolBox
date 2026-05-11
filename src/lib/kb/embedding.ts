const DASHSCOPE_API = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
const BATCH_SIZE = 10;
const BATCH_DELAY = 200;

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 3000): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      console.error(`Embedding 重试 ${i + 1}/${retries}:`, err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY 未配置');

  const response = await fetch(DASHSCOPE_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-v3',
      input: { texts },
      parameters: { dimension: 1024 },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding API 失败: ${response.status} ${body}`);
  }

  const data = await response.json();
  const embeddings: Array<{ embedding: number[]; text_index: number }> = data.output.embeddings;
  // Sort by text_index to ensure order
  embeddings.sort((a, b) => a.text_index - b.text_index);
  return embeddings.map((e) => e.embedding);
}

/**
 * Embed multiple texts in batches of 25
 */
export async function embedTexts(
  texts: string[],
  onProgress?: (done: number, total: number) => void
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await withRetry(() => embedBatch(batch));
    results.push(...embeddings);

    if (onProgress) onProgress(results.length, texts.length);

    // Delay between batches to respect rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY));
    }
  }

  return results;
}

/**
 * Embed a single query text
 */
export async function embedQuery(text: string): Promise<number[]> {
  const results = await withRetry(() => embedBatch([text]));
  return results[0];
}
