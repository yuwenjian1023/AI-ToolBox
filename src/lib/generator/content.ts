import { callLLM } from '@/lib/llm';
import type { ASRResult, Task } from '@/types';

const SEPARATOR = '===MERMAID_MINDMAP===';

const SYSTEM_PROMPT = `你是一个专业的内容编辑，擅长将语音转录文本整理成结构清晰的 Markdown 文档，同时能生成 Mermaid 思维导图。

你的输出分为两部分，用 ${SEPARATOR} 分隔：

第一部分：结构化 Markdown 文档
第二部分：Mermaid 思维导图代码

格式规范（必须严格遵守）：
- 一级标题只用一个 #，例如：# 标题
- 二级标题只用两个 #，例如：## 标题
- 三级标题只用三个 #，例如：### 标题
- 绝对不要写成 ## ## 或 # # 这样重复的格式
- 标题的 # 号和文字之间只有一个空格
- 思维导图部分只输出纯 Mermaid 代码，不要加 \`\`\`mermaid 标记`;

function buildUserPrompt(asrResult: ASRResult, task: Task): string {
  const sourceLabel = task.source === 'bilibili' ? 'Bilibili 视频' : '小宇宙播客';

  return `请将以下语音转录文本整理为两部分内容，用 ${SEPARATOR} 分隔。

===== 第一部分：Markdown 文档 =====
1. 提取核心主题作为文档标题（# 标题）
2. 在标题下方添加元信息：来源、原始链接、生成时间
3. 添加一段 200 字以内的内容摘要（用 > 引用块）
4. 识别主要讨论话题，为每个话题创建二级标题（## 标题）
5. 在每个话题下用要点列表组织内容
6. 保留重要的原始表述（用 > 引用块标注）
7. 如果有多位说话人，标注说话人身份
8. 在文档末尾添加"关键要点"总结章节

===== 第二部分：Mermaid 思维导图 =====
1. 使用 mindmap 语法
2. 根节点用双圆括号 ((主题)) 表示
3. 用缩进表示层级关系（每级 2 个空格，保持一致）
4. 第一层是核心主题分类（3-6 个）
5. 每个主题下列出关键要点（2-4 个）
6. 节点文字简洁（不超过 15 个字）
7. 总节点数控制在 15-40 个之间

输出格式示例：
# 文档标题
...markdown 内容...
${SEPARATOR}
mindmap
  root((核心主题))
    话题一
      要点A

元信息：
- 来源：${sourceLabel}
- 标题：${task.title}
- 链接：${task.url}

转录文本：
${asrResult.fullText}`;
}

function fixMarkdownHeadings(md: string): string {
  return md.replace(/^(#{1,6})\s+\1\s+/gm, '$1 ');
}

function cleanMermaidCode(code: string): string {
  return code
    .replace(/^```mermaid\s*/i, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();
}

export interface GeneratedContent {
  markdown: string;
  mermaidCode: string;
}

export async function generateContent(
  asrResult: ASRResult,
  task: Task
): Promise<GeneratedContent> {
  const raw = await callLLM(SYSTEM_PROMPT, buildUserPrompt(asrResult, task));

  const parts = raw.split(SEPARATOR);

  if (parts.length < 2) {
    // Fallback: treat entire output as markdown, no mermaid
    return {
      markdown: fixMarkdownHeadings(raw.trim()),
      mermaidCode: '',
    };
  }

  const markdown = fixMarkdownHeadings(parts[0].trim());
  const mermaidCode = cleanMermaidCode(parts[1].trim());

  return { markdown, mermaidCode };
}
