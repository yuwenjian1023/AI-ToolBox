import { kbStore } from './store';
import { embedQuery } from './embedding';
import { findTopK } from './similarity';
import { callLLM } from '@/lib/llm';
import type { RAGResult, KBCategory } from '@/types/kb';

const SYSTEM_PROMPT = `你是一个专业的 TapSDK 技术支持助手，基于知识库内容精准、简洁地回答用户咨询。

【强制规则】
1. 答案必须来自参考资料的原文摘录或最小化改写。禁止：
   - 推断、补全、扩展参考资料中没写的内容
   - 把多个参考资料"融合"成新的步骤或结论
   - 生成参考资料里没出现的代码、配置、命令、版本号
2. 当参考资料中包含"原文链接"时，必须在答案开头用 markdown 链接引用对应文档（例如：参考[文档标题](url)文档。集成步骤如下：1. ... 2. ...）
3. 用户咨询异常报错时，如果未提供 SDK 版本号、引擎（Unity/Android/iOS"请提供 SDK 版本、引擎、报错日志、异常现象，方便定位问题。"
4. 如果用户问题模糊（未指定平台/引擎/SDK 类型），先反问 1-2 个最关键的槽位，不要硬答
5. 如果参考资料没有完全匹配的答案，只回答能确定的部分，剩下的写"该部分知识库未覆盖"
6. 回答长度上限：3-5 行能说清就不要列 10 条；能直接给链接/命令/代码就不要展开描述
7. 禁止出现"参考"、"资料"、"根据"、"基于"等元描述词，像你本来就知道这些知识一样回答
8. 涉及步骤操作时使用有序列表；输出 Markdown 格式`;

// Detect what kind of doc the user wants, so retrieval can boost matches.
// how-to questions → guides; error/issue questions → FAQs.
function detectIntent(question: string): KBCategory | undefined {
  if (/如何|怎么|怎样|集成|接入|入门|开始|教程|步骤|流程|指南|使用方法/.test(question)) return 'guide';
  if (/报错|异常|失败|为什么|不能|无法|错误|bug|crash|崩溃|不生效|不显示/.test(question)) return 'faq';
  return undefined;
}

export async function queryKnowledgeBase(
  question: string,
  topK = 3,
  inviteCode?: string
): Promise<RAGResult> {
  // 1. Embed the question
  const queryVec = await embedQuery(question);

  // 2. Hybrid retrieval (vector + keyword + intent boost)
  const allChunks = kbStore.getAllChunksWithEmbeddings(inviteCode);
  if (allChunks.length === 0) {
    return {
      answer: '知识库中暂无文档，请先添加文档。',
      sources: [],
    };
  }

  const intent = detectIntent(question);
  const topResults = findTopK(queryVec, allChunks, topK, question, intent);

  // Debug log: helps tune thresholds and observe boost effect
  console.log('[RAG]', JSON.stringify({
    question,
    intent,
    top: topResults.map((r) => ({
      score: Math.round(r.score * 100) / 100,
      category: r.category,
      preview: r.content.slice(0, 50),
    })),
  }));

  const relevant = topResults.filter((r) => r.score > 0.45);
  if (relevant.length === 0 || topResults[0].score < 0.6) {
    return {
      answer: '知识库中没有找到与该问题足够相关的内容。可以补充：使用的引擎（Unity/Cocos/原生）？平台（Android/iOS）？SDK 版本？',
      sources: [],
    };
  }

  // 3. Assemble context.
  //    For guide intent: aggregate top hits by doc, pick the primary doc,
  //    and pull its first 4 chunks (overview / TOC / intro) so the LLM can
  //    summarize the whole guide instead of riffing on one fragment.
  //    For other intents: use the topK chunks as-is.
  const titleMap = kbStore.getDocumentTitleMap(inviteCode);

  let context: string;
  let primaryHint = '';

  if (intent === 'guide') {
    // Aggregate scores by docId to find the primary doc.
    const docScore = new Map<string, number>();
    for (const r of relevant) {
      docScore.set(r.docId, (docScore.get(r.docId) || 0) + r.score);
    }
    const primaryDocId = [...docScore.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const primaryTitle = titleMap[primaryDocId] || '主指南文档';
    const primaryChunks = kbStore.getDocChunksOrdered(primaryDocId, 4);
    const primaryUrl = primaryChunks.find((c) => c.sourceUrl)?.sourceUrl;

    const linkLine = primaryUrl ? `\n原文链接: ${primaryUrl}\n文档标题: ${primaryTitle}` : `\n文档标题: ${primaryTitle}`;
    context = primaryChunks.map((c) => c.content).join('\n\n') + linkLine;

    primaryHint = `\n\n【任务说明】用户在问 how-to 类问题。请：
1. 在答案开头用 markdown 链接引用上面的"原文链接"指向的文档
2. 基于上面整段文档内容，提炼出 3-6 个高层集成步骤（用有序列表）
3. 不要展开每一步的具体细节（除非参考资料中有明确写）；如需细节让用户查阅原文`;
  } else {
    const contextParts = relevant.map((r) => {
      const linkLine = r.sourceUrl
        ? `\n原文链接: ${r.sourceUrl}\n文档标题: ${titleMap[r.docId] || ''}`
        : '';
      return `${r.content}${linkLine}`;
    });
    context = contextParts.join('\n\n---\n\n');
  }

  // 4. LLM call
  const userMessage = `参考资料：

${context}

---

用户问题：${question}${primaryHint}`;

  let answer: string;
  try {
    answer = await callLLM(SYSTEM_PROMPT, userMessage);
  } catch (err) {
    console.error('RAG LLM 调用失败:', err);
    answer = '抱歉，生成回答时出错了，请重试。';
  }
  if (!answer || !answer.trim()) {
    answer = '抱歉，未能生成有效回答，请重试。';
  }

  return {
    answer,
    sources: relevant.map((r) => ({
      docId: r.docId,
      docTitle: titleMap[r.docId] || '未知文档',
      chunkContent: r.content.slice(0, 200),
      score: Math.round(r.score * 100) / 100,
    })),
  };
}
