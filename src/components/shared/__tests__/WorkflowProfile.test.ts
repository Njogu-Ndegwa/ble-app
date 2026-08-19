import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import WorkflowProfile, { type WorkflowProfileProps } from '../WorkflowProfile';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'common.active': 'Active',
      'common.guest': 'Guest',
      'common.logout': 'Log Out',
      'profile.emailAddress': 'Email Address',
      'profile.employeeId': 'Employee ID',
      'rider.helpSupport': 'Help & Support',
      'rider.supportDesc': 'FAQs, contact support',
    })[key] ?? key,
  }),
}));

function renderProfile(employee: WorkflowProfileProps['employee']) {
  return renderToStaticMarkup(
    React.createElement(WorkflowProfile, {
      employee,
      onLogout: () => undefined,
      roleLabel: 'Device Manager',
    }),
  );
}

describe('WorkflowProfile employee ID', () => {
  it('hides the row for a guest', () => {
    expect(renderProfile(null)).not.toContain('Employee ID');
  });

  it.each(['N/A', ' n/a ', 'NA'])('hides the row for the placeholder %j', id => {
    const html = renderProfile({ id, name: 'Guest', email: '' });

    expect(html).not.toContain('Employee ID');
    expect(html).not.toContain(`#${id}`);
  });

  it('shows numeric ID zero', () => {
    const html = renderProfile({ id: 0, name: 'Zero User', email: '' });

    expect(html).toContain('Employee ID');
    expect(html).toContain('#0');
  });

  it('shows a normal ID', () => {
    const html = renderProfile({ id: 42, name: 'Normal User', email: '' });

    expect(html).toContain('Employee ID');
    expect(html).toContain('#42');
  });
});
