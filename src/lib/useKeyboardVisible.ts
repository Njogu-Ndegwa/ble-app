'use client';

import { useEffect } from 'react';

const INPUT_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
const BLUR_DELAY = 80;
const NO_KEYBOARD_TYPES = new Set([
  'checkbox', 'radio', 'file', 'range', 'color', 'hidden', 'submit', 'reset', 'button', 'image',
]);

/**
 * Detects mobile virtual keyboard visibility by tracking input focus.
 * When any text-entry input receives focus, `.keyboard-open` is toggled
 * on <html> so CSS can hide non-essential fixed/sticky chrome (header,
 * timeline, nav, action bar) to maximise typing space.
 *
 * Uses focusin/focusout rather than VisualViewport because many mobile
 * browsers (Android WebViews, PWA shells) resize both the layout and
 * visual viewports together, making viewport-height diffing unreliable.
 */
export function useKeyboardVisible() {
  useEffect(() => {
    let blurTimer: ReturnType<typeof setTimeout> | null = null;
    let isOpen = false;

    function setKeyboardOpen(open: boolean) {
      if (open === isOpen) return;
      isOpen = open;
      document.documentElement.classList.toggle('keyboard-open', isOpen);

      if (isOpen) {
        requestAnimationFrame(() => {
          const el = document.activeElement;
          if (el && el instanceof HTMLElement) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    }

    function onFocusIn(e: FocusEvent) {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches(INPUT_SELECTOR)) return;

      if (target instanceof HTMLInputElement && NO_KEYBOARD_TYPES.has(target.type)) {
        return;
      }

      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
      setKeyboardOpen(true);
    }

    function onFocusOut() {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        const active = document.activeElement;
        const stillInInput = active instanceof HTMLElement && active.matches(INPUT_SELECTOR);
        if (!stillInInput) {
          setKeyboardOpen(false);
        }
      }, BLUR_DELAY);
    }

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);

    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      if (blurTimer) clearTimeout(blurTimer);
      document.documentElement.classList.remove('keyboard-open');
    };
  }, []);
}
