import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import WorkflowProfile from '../WorkflowProfile';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => (key === 'common.guest' ? 'Guest' : ''),
  }),
}));

describe('WorkflowProfile', () => {
  it('renders guest initials that match the guest name when no employee exists', () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkflowProfile, {
        employee: null,
        onLogout: vi.fn(),
        roleLabel: 'Device Manager',
        fallbackInitials: 'DM',
      }),
    );

    expect(markup).toContain('>G</div>');
    expect(markup).toContain('>Guest</h2>');
    expect(markup).not.toContain('>DM</div>');
  });
});
