export type LinkSource = 'bilibili' | 'xiaoyuzhou';

export type TaskStatus =
  | 'pending'
  | 'downloading'
  | 'transcribing'
  | 'structuring'
  | 'saving'
  | 'completed'
  | 'failed';

export interface Task {
  id: string;
  url: string;
  source: LinkSource;
  title: string;
  status: TaskStatus;
  progress: number;
  statusMessage: string;
  audioPath?: string;
  transcript?: string;
  markdown?: string;
  mermaidCode?: string;
  outputPath?: string;
  mindmapPngPath?: string;
  xmindPath?: string;
  ossFiles?: {
    md?: string;
    xmind?: string;
    png?: string;
  };
  error?: string;
  inviteCode?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ProgressEvent {
  taskId: string;
  status: TaskStatus;
  progress: number;
  message: string;
}

export interface ASRSentence {
  text: string;
  beginTime: number;
  endTime: number;
  speakerId?: number;
}

export interface ASRResult {
  fullText: string;
  sentences: ASRSentence[];
}
