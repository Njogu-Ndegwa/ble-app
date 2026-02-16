'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/app/context/themeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        background: 'var(--bg-tertiary)',
        color: 'var(--accent)',
        cursor: 'pointer',
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-elevated)';
        e.currentTarget.style.borderColor = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-tertiary)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
