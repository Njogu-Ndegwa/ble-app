// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let hasSession = false;
let root: Root | null = null;
let container: HTMLDivElement | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => ({
  usePathname: () => '/signin',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: ({ priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => React.createElement('img', props),
}));

vi.mock('@/i18n', () => ({
  useI18n: () => ({ locale: 'en', setLocale: vi.fn(), t: (key: string) => key }),
}));

vi.mock('@/components/ui/ThemeToggle', () => ({
  default: () => React.createElement('button', { 'aria-label': 'Theme toggle' }),
}));

vi.mock('@/lib/ov-auth', () => ({
  clearSelectedSA: vi.fn(),
  getOdooEmployee: () => ({ name: 'Stale User', email: 'stale@example.test' }),
  getSelectedSA: () => ({ id: 1, name: 'Oves Togo' }),
  isOdooEmployeeLoggedIn: () => hasSession,
}));

vi.mock('@/lib/attendant-auth', () => ({ clearAllAuth: vi.fn() }));

import AppHeader from '../AppHeader';

describe('AppHeader account controls', () => {
  beforeEach(() => {
    hasSession = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  it('hides stale workspace and avatar data after client effects run without a valid session', async () => {
    await act(async () => {
      root?.render(React.createElement(AppHeader));
    });

    expect(container?.textContent).not.toContain('Oves Togo');
    expect(container?.querySelector('.app-header-avatar-btn')).toBeNull();
    expect(container?.querySelector('[aria-label="Theme toggle"]')).not.toBeNull();
  });

  it('shows account controls after client effects confirm a valid session', async () => {
    hasSession = true;

    await act(async () => {
      root?.render(React.createElement(AppHeader));
    });

    expect(container?.textContent).toContain('Oves Togo');
    expect(container?.querySelector('.app-header-avatar-btn')).not.toBeNull();
  });
});
