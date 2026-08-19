import { describe, expect, it } from 'vitest';

import { getAccountControlVisibility } from '../app-header-session';

describe('getAccountControlVisibility', () => {
  it('hides stale workspace and user controls without an authenticated session', () => {
    expect(getAccountControlVisibility({
      hasSession: false,
      hasSelectedSA: true,
      hasSignInAction: false,
    })).toEqual({ showWorkspace: false, showAvatar: false });
  });

  it('shows account controls for an authenticated session', () => {
    expect(getAccountControlVisibility({
      hasSession: true,
      hasSelectedSA: true,
      hasSignInAction: false,
    })).toEqual({ showWorkspace: true, showAvatar: true });
  });

  it('keeps public-page sign-in actions mutually exclusive with account controls', () => {
    expect(getAccountControlVisibility({
      hasSession: true,
      hasSelectedSA: true,
      hasSignInAction: true,
    })).toEqual({ showWorkspace: false, showAvatar: false });
  });
});
