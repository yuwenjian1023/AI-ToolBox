import { callLLM } from '@/lib/llm';
import type { ASRResult, Task } from '@/types';

const SYSTEM_PROMPT = `你是一个专业的内容编辑，擅长将语音转录文本整理成结构清晰的 Markdown 文档。
你的输出必须是纯 Markdown 格式，不要包含任何解释性文字。

格式规范（必须严格遵守）：
- 一级标题只用一个 #，例如：# 标题
- 二级标题只用两个 #，例如：## 标题
- 三级标题只用三个 #，例如：### 标题
- 绝对不要写成 ## ## 或 # # 这样重复的格式
- 标题的 # 号和文字之间只有一个空格`;

function buildUserPrompt(asrResult: ASRResult, task: Task): string {
  const sourceLabel = task.source === 'bilibili' ? 'Bilibili 视频' : '小宇宙播客';

  return `请将以下语音转录文本整理成结构清晰的 Markdown 文档。

要求：
1. 提取核心主题作为文档标题（# 标题）
2. 在标题下方添加元信息：来源、原始链接、生成时间
3. 添加一段 200 字以内的内容摘要（用 > 引用块）
4. 识别主要讨论话题，为每个话题创建二级标题（## 标题）
5. 在每个话题下用要点列表组织内容
6. 保留重要的原始表述（用 > 引用块标注）
7. 如果有多位说话人，标注说话人身份
8. 在文档末尾添加"关键要点"总结章节

元信息：
- 来源：${sourceLabel}
- 标题：${task.title}
- 链接：${task.url}

转录文本：
${asrResult.fullText}`;
}

/**
 * Fix malformed headings like "## ## Title" → "## Title"
 */
function fixMarkdownHeadings(md: string): string {
  return md.replace(/^(#{1,6})\s+\1\s+/gm, '$1 ');
}

export async function generateStructuredMarkdown(
  asrResult: ASRResult,
  task: Task
): Promise<string> {
  const raw = await callLLM(SYSTEM_PROMPT, buildUserPrompt(asrResult, task));
  return fixMarkdownHeadings(raw);
}
