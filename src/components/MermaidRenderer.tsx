'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  code: string;
}

export default function MermaidRenderer({ code }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current || !code) return;

      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
        });

        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, code);

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className="bg-foreground/5 rounded-lg p-4">
        <p className="text-sm text-foreground/50 mb-2">Mermaid 渲染失败，原始代码：</p>
        <pre className="text-sm overflow-x-auto whitespace-pre-wrap">{code}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex justify-center overflow-x-auto bg-white dark:bg-foreground/5 rounded-lg p-4"
    />
  );
}
