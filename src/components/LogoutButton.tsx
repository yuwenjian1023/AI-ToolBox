'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <button
      onClick={handleLogout}
      className="px-3 py-1.5 rounded-lg text-sm text-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors"
    >
      退出登录
    </button>
  );
}
