'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReactNode } from 'react';
import MermaidRenderer from './MermaidRenderer';

interface Props {
  content: string;
}

export default function MarkdownPreview({ content }: Props) {
  return (
    <div className="markdown-body text-sm leading-relaxed text-foreground max-w-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:my-2 [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-foreground/20 [&_blockquote]:pl-4 [&_blockquote]:my-3 [&_blockquote]:text-foreground/70 [&_code]:bg-foreground/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-foreground/10 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_hr]:my-4 [&_hr]:border-foreground/10 [&_a]:text-blue-500 [&_a]:underline [&_strong]:font-semibold [&_table]:w-full [&_table]:my-3 [&_th]:text-left [&_th]:border-b [&_th]:border-foreground/20 [&_th]:py-2 [&_th]:px-3 [&_td]:border-b [&_td]:border-foreground/10 [&_td]:py-2 [&_td]:px-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            const child = children as ReactNode & {
              props?: { className?: string; children?: string };
            };
            if (
              child &&
              typeof child === 'object' &&
              'props' in child &&
              /language-mermaid/.test(child.props?.className || '')
            ) {
              return (
                <MermaidRenderer code={String(child.props?.children || '').trim()} />
              );
            }
            return <pre>{children}</pre>;
          },
        }}
      />
    </div>
  );
}
