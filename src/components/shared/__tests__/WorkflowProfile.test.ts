import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => (key === 'common.guest' ? 'Guest' : ''),
  }),
}));

import WorkflowProfile from '../WorkflowProfile';

describe('WorkflowProfile', () => {
  it('derives anonymous avatar initials from the displayed guest name', () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkflowProfile, {
        employee: null,
        onLogout: () => undefined,
        roleLabel: 'Device Manager',
        fallbackInitials: 'DM',
      }),
    );

    expect(markup).toContain('>G</div><h2');
    expect(markup).toContain('>Guest</h2>');
  });
});
