'use client';

import { useState } from 'react';
import Sidebar from '../../components/sidebar/sidebar';   // wherever you put the sidebar file
import { User } from 'lucide-react';

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#24272C] to-[#0C0C0E]">
      {open && <Sidebar onClose={() => setOpen(false)} />}

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        />
      )}

      <header className="flex items-center gap-4 px-4 py-3">
        <User
          className="w-6 h-6 text-gray-400 cursor-pointer"
          onClick={() => setOpen(true)}
        />
        <h2 className="text-white font-medium flex-1 text-center">
          OV&nbsp;App
        </h2>
        <span className="w-6 h-6" /> {/* spacer */}
      </header>

      <main className={`${open ? 'opacity-30' : ''} transition-opacity duration-300 p-4`}>
        {children}
      </main>
    </div>
  );
}
