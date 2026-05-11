'use client';

import { useEffect } from 'react';

interface Props {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}

export default function Toast({ message, type = 'success', onClose }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
      <div
        className={`px-5 py-3 rounded-lg shadow-lg text-sm font-medium ${
          type === 'success'
            ? 'bg-green-600 text-white'
            : 'bg-red-500 text-white'
        }`}
      >
        {message}
      </div>
    </div>
  );
}
