import { taskStore } from '@/lib/taskStore';
import { downloadBilibili } from '@/lib/downloader/bilibili';
import { downloadXiaoyuzhou } from '@/lib/downloader/xiaoyuzhou';
import { uploadToOSS, deleteFromOSS, transcribeAudio, uploadGeneratedFile } from '@/lib/asr/aliyun';
import { generateContent } from '@/lib/generator/content';
import { saveMarkdownFile, cleanupTempFile, renderMermaidToFile } from '@/lib/utils/fileManager';
import { generateXMindFile } from '@/lib/generator/xmind';

export async function runPipeline(taskId: string) {
  const task = taskStore.getTask(taskId);
  if (!task) return;

  try {
    // ===== 1. Download audio =====
    taskStore.updateProgress(taskId, 'downloading', 0, '正在下载音频...');

    let audioPath: string;
    let title: string;

    if (task.source === 'bilibili') {
      const result = await downloadBilibili(task.url, taskId, (pct) => {
        taskStore.updateProgress(taskId, 'downloading', pct, `下载中 ${pct}%`);
      });
      audioPath = result.audioPath;
      title = result.title;
    } else {
      const result = await downloadXiaoyuzhou(task.url, taskId, (pct) => {
        taskStore.updateProgress(taskId, 'downloading', pct, `下载中 ${pct}%`);
      });
      audioPath = result.audioPath;
      title = result.title;
    }

    taskStore.updateTask(taskId, { audioPath, title });
    taskStore.updateProgress(taskId, 'downloading', 100, '音频下载完成');

    // ===== 2. Upload to OSS =====
    taskStore.updateProgress(taskId, 'transcribing', 0, '正在上传音频到云端...');
    const audioUrl = await uploadToOSS(audioPath, taskId);
    taskStore.updateProgress(taskId, 'transcribing', 10, '音频上传完成，开始语音识别...');

    // ===== 3. ASR =====
    const asrResult = await transcribeAudio(audioUrl, (pct) => {
      taskStore.updateProgress(taskId, 'transcribing', 10 + Math.round(pct * 0.9), '语音识别中...');
    });
    taskStore.updateTask(taskId, { transcript: asrResult.fullText });
    taskStore.updateProgress(taskId, 'transcribing', 100, '语音识别完成');

    // ===== 4. LLM: Markdown + Mermaid (single call) =====
    taskStore.updateProgress(taskId, 'structuring', 0, '正在用 AI 整理内容并生成思维导图...');
    const updatedTask = taskStore.getTask(taskId)!;
    const { markdown: structuredMd, mermaidCode } = await generateContent(asrResult, updatedTask);

    const fullMarkdown = mermaidCode
      ? `${structuredMd}\n\n## 内容思维导图\n\n\`\`\`mermaid\n${mermaidCode}\n\`\`\`\n`
      : structuredMd;
    taskStore.updateTask(taskId, { mermaidCode, markdown: fullMarkdown });
    taskStore.updateProgress(taskId, 'structuring', 100, 'AI 整理完成');

    // ===== 5. Save files locally =====
    taskStore.updateProgress(taskId, 'saving', 0, '正在生成文件...');
    const finalTask = taskStore.getTask(taskId)!;
    const outputPath = await saveMarkdownFile(finalTask);

    let xmindPath: string | undefined;
    if (mermaidCode) {
      try {
        xmindPath = await generateXMindFile(mermaidCode, finalTask.title, taskId);
      } catch (err) {
        console.error('XMind 生成失败:', err);
      }
    }

    let pngPath: string | undefined;
    if (mermaidCode) {
      try {
        const result = await renderMermaidToFile(mermaidCode, finalTask);
        pngPath = result.pngPath;
      } catch (err) {
        console.error('PNG 渲染失败:', err);
      }
    }

    // ===== 6. Upload to OSS + cleanup local =====
    taskStore.updateProgress(taskId, 'saving', 50, '正在上传文件到云端...');
    const ossFiles: { md?: string; xmind?: string; png?: string } = {};

    try {
      const mdKey = `generated/${taskId}/${taskId}.md`;
      await uploadGeneratedFile(outputPath, mdKey);
      ossFiles.md = mdKey;
      await cleanupTempFile(outputPath); // Remove local copy
    } catch (err) {
      console.error('上传 MD 到 OSS 失败:', err);
    }

    if (xmindPath) {
      try {
        const xmindKey = `generated/${taskId}/${taskId}.xmind`;
        await uploadGeneratedFile(xmindPath, xmindKey);
        ossFiles.xmind = xmindKey;
        await cleanupTempFile(xmindPath);
      } catch (err) {
        console.error('上传 XMind 到 OSS 失败:', err);
      }
    }

    if (pngPath) {
      try {
        const pngKey = `generated/${taskId}/${taskId}.png`;
        await uploadGeneratedFile(pngPath, pngKey);
        ossFiles.png = pngKey;
        await cleanupTempFile(pngPath);
      } catch (err) {
        console.error('上传 PNG 到 OSS 失败:', err);
      }
    }

    taskStore.updateTask(taskId, {
      ossFiles,
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    taskStore.updateProgress(taskId, 'completed', 100, '全部完成!');

    // Cleanup audio
    await cleanupTempFile(audioPath);
    await deleteFromOSS(taskId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    taskStore.updateTask(taskId, { status: 'failed', error: message });
    taskStore.updateProgress(taskId, 'failed', 0, `处理失败: ${message}`);
  }
}
