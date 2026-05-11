import { callLLM } from '@/lib/llm';

const SYSTEM_PROMPT = `你是一个 Mermaid 图表专家，擅长制作思维导图。你只输出合法的 Mermaid 代码，不要包含任何其他文字、解释或 markdown 代码块标记。`;

function buildUserPrompt(markdown: string): string {
  return `基于以下内容，生成一个 Mermaid 思维导图，展示内容的知识架构和讨论脉络，类似 XMind 的效果。

要求：
1. 使用 mindmap 语法
2. 根节点用双圆括号 ((主题)) 表示
3. 用缩进表示层级关系（每级 2 个空格或 4 个空格，保持一致）
4. 第一层是核心主题分类（3-6 个）
5. 每个主题下列出关键要点（2-4 个）
6. 节点文字简洁（不超过 15 个字）
7. 总节点数控制在 15-40 个之间
8. 只输出 Mermaid 代码本身，不要加 \`\`\`mermaid 标记

示例格式：
mindmap
  root((核心主题))
    话题一
      要点A
      要点B
    话题二
      要点C
      要点D
        细节1
    话题三
      要点E

内容：
${markdown}`;
}

export async function generateMermaid(markdown: string): Promise<string> {
  const result = await callLLM(SYSTEM_PROMPT, buildUserPrompt(markdown));

  // Clean up: remove any markdown code block markers if LLM adds them
  return result
    .replace(/^```mermaid\s*/i, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();
}
