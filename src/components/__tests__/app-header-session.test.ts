import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let hasSession = false;

vi.mock('next/navigation', () => ({
  usePathname: () => '/signin',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props),
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
  });

  it('uses the same account-control markup during server and browser hydration', () => {
    const serverMarkup = renderToString(React.createElement(AppHeader));

    hasSession = true;
    const hydrationMarkup = renderToString(React.createElement(AppHeader));

    expect(hydrationMarkup).toBe(serverMarkup);
  });

  it('hides stale workspace and avatar data on the signed-out sign-in page', () => {
    const markup = renderToString(React.createElement(AppHeader));

    expect(markup).not.toContain('Oves Togo');
    expect(markup).not.toContain('app-header-avatar-btn');
    expect(markup).toContain('Theme toggle');
  });
});
