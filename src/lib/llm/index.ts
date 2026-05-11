import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 3000): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      console.error(`重试 ${i + 1}/${retries}:`, err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

export async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  return withRetry(() => callLLMOnce(systemPrompt, userMessage));
}

async function callLLMOnce(systemPrompt: string, userMessage: string): Promise<string> {
  const provider = process.env.LLM_PROVIDER || 'anthropic';

  if (provider === 'anthropic') {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = message.content[0];
    if (block.type === 'text') return block.text;
    throw new Error('LLM 返回了非文本内容');
  }

  if (provider === 'dashscope') {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) throw new Error('DASHSCOPE_API_KEY 未配置');

    const response = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.DASHSCOPE_LLM_MODEL || 'qwen-plus',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 8192,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`DashScope LLM 调用失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  throw new Error(`不支持的 LLM 提供商: ${provider}`);
}
