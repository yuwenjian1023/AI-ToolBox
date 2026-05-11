import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';

const tools = [
  {
    name: '音视频转 Markdown',
    description: '粘贴 Bilibili 视频或小宇宙播客链接，自动转录为结构化 Markdown 文档并生成思维导图',
    href: '/audio',
    color: 'from-blue-500 to-cyan-500',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
      </svg>
    ),
  },
  {
    name: '智能知识库',
    description: '导入文档、网页、飞书表格等多种来源，构建个人知识库并进行智能问答',
    href: '/kb',
    color: 'from-emerald-500 to-teal-500',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.331 0 4.472.89 6.075 2.356M12 6.042c1.624-1.466 3.744-2.292 6-2.292 1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18c-2.331 0-4.472.89-6.075 2.356M12 6.042V20.356" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center px-4 py-20 relative">
      <div className="absolute top-6 right-6">
        <LogoutButton />
      </div>
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">AI 工具箱</h1>
        <p className="text-foreground/50 max-w-md mx-auto">
          一站式 AI 工具集合，提升你的工作效率
        </p>
      </div>

      <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group relative flex flex-col rounded-xl border border-foreground/10 bg-foreground/5 p-6 hover:border-foreground/20 hover:bg-foreground/8 transition-all"
          >
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${tool.color} flex items-center justify-center text-white mb-4`}>
              {tool.icon}
            </div>
            <h2 className="text-base font-semibold mb-2 group-hover:text-blue-500 transition-colors">
              {tool.name}
            </h2>
            <p className="text-sm text-foreground/50 leading-relaxed">
              {tool.description}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-20 text-center text-xs text-foreground/20">
        <p>Powered by DashScope + Qwen</p>
      </div>
    </main>
  );
}
