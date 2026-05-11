'use client';

import { useEffect, useState, useRef } from 'react';

const STEPS = [
  { key: 'downloading', label: '下载音频' },
  { key: 'transcribing', label: '语音识别' },
  { key: 'structuring', label: 'AI 整理' },
  { key: 'saving', label: '保存上传' },
  { key: 'completed', label: '完成' },
];

interface Props {
  taskId: string;
  onComplete: () => void;
  onError: (message: string) => void;
}

export default function ProgressPanel({ taskId, onComplete, onError }: Props) {
  const [currentStatus, setCurrentStatus] = useState('pending');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('等待处理...');
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      while (!stopped) {
        try {
          const res = await fetch(`/api/result/${taskId}`);
          if (!res.ok) break;
          const data = await res.json();

          if (stopped) break;

          setCurrentStatus(data.status);
          setProgress(data.progress ?? 0);
          setMessage(data.statusMessage ?? '');

          if (data.status === 'completed') {
            onCompleteRef.current();
            return;
          }
          if (data.status === 'failed') {
            onErrorRef.current(data.statusMessage || data.error || '处理失败');
            return;
          }
        } catch {
          // network error, retry
        }

        // Wait 1.5s before next poll
        await new Promise((r) => setTimeout(r, 1500));
      }
    };

    poll();

    return () => {
      stopped = true;
    };
  }, [taskId]);

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStatus);

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <div className="bg-foreground/5 rounded-xl p-6">
        {/* Step indicators */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, i) => {
            const isActive = step.key === currentStatus;
            const isDone = currentStepIndex > i || currentStatus === 'completed';
            const isFailed = currentStatus === 'failed';

            return (
              <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isDone
                      ? 'bg-green-500 text-white'
                      : isActive && !isFailed
                      ? 'bg-blue-500 text-white animate-pulse'
                      : isActive && isFailed
                      ? 'bg-red-500 text-white'
                      : 'bg-foreground/10 text-foreground/40'
                  }`}
                >
                  {isDone ? '\u2713' : i + 1}
                </div>
                <span
                  className={`text-xs text-center ${
                    isActive ? 'text-foreground font-medium' : 'text-foreground/40'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        {currentStatus !== 'completed' && currentStatus !== 'failed' && (
          <div className="w-full h-2 bg-foreground/10 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Status message */}
        <p className="text-sm text-center text-foreground/70">{message}</p>
      </div>
    </div>
  );
}
