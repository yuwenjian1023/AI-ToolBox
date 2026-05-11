export type KBSourceType =
  | 'text'
  | 'url'
  | 'site'
  | 'upload_md'
  | 'upload_docx'
  | 'upload_csv'
  | 'upload_pdf'
  | 'feishu'
  | 'audio_import';

export type KBDocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

// guide=指南/教程, faq=问答, reference=API/参考
export type KBCategory = 'guide' | 'faq' | 'reference';

export interface KBDocument {
  id: string;
  title: string;
  sourceType: KBSourceType;
  sourceRef: string;
  contentRaw: string;
  chunkCount: number;
  status: KBDocumentStatus;
  category: KBCategory;
  error?: string;
  inviteCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KBChunk {
  id: string;
  docId: string;
  chunkIndex: number;
  content: string;
  embedding?: number[];
  tokenCount?: number;
  sourceUrl?: string;
  createdAt: string;
}

export interface KBProgressEvent {
  docId: string;
  status: KBDocumentStatus;
  progress: number;
  message: string;
}

export interface RAGResult {
  answer: string;
  sources: Array<{
    docId: string;
    docTitle: string;
    chunkContent: string;
    score: number;
  }>;
}
