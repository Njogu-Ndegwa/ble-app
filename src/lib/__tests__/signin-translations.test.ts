import { describe, expect, it } from 'vitest';

import en from '../../i18n/messages/en.json';
import fr from '../../i18n/messages/fr.json';

describe('sign-in translations', () => {
  it('labels the divider with the Microsoft sign-in method in each locale', () => {
    expect(en['auth.orSignInWith']).toBe('or sign in with Microsoft');
    expect(fr['auth.orSignInWith']).toBe('ou se connecter avec Microsoft');
  });
});
