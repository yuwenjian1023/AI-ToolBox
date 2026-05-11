'use client';

import Link from 'next/link';
import TaskList from '@/components/TaskList';

export default function HistoryPage() {
  return (
    <main className="flex-1 flex flex-col px-4 py-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-blue-500 hover:underline mb-2 inline-block">
            &larr; 返回首页
          </Link>
          <h1 className="text-xl font-bold">历史记录</h1>
        </div>
      </div>

      <TaskList />
    </main>
  );
}
