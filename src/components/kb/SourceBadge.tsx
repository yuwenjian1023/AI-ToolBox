'use client';

const LABELS: Record<string, { text: string; color: string }> = {
  text: { text: '文本', color: 'bg-gray-500' },
  url: { text: '网页', color: 'bg-blue-500' },
  site: { text: '站点', color: 'bg-blue-700' },
  upload_md: { text: 'MD', color: 'bg-green-500' },
  upload_docx: { text: 'Word', color: 'bg-indigo-500' },
  upload_csv: { text: 'CSV', color: 'bg-yellow-600' },
  upload_pdf: { text: 'PDF', color: 'bg-red-500' },
  feishu: { text: '飞书', color: 'bg-purple-500' },
  audio_import: { text: '音视频', color: 'bg-cyan-500' },
};

export default function SourceBadge({ sourceType }: { sourceType: string }) {
  const info = LABELS[sourceType] || { text: sourceType, color: 'bg-gray-500' };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] text-white ${info.color}`}>
      {info.text}
    </span>
  );
}
