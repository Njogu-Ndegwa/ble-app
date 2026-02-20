'use client';

import { useEffect } from 'react';

const INPUT_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

/**
 * How long to wait after focusout before removing `.keyboard-open`.
 * Must be long enough for:
 *  - focus to transfer between inputs (e.g. phone input → country search)
 *  - the mobile keyboard dismiss animation to finish (~250-300ms)
 * This prevents chrome from flashing back during input-to-input transitions
 * and eliminates the "snap" when elements reappear while the viewport is
 * still expanding after keyboard close.
 */
const BLUR_DELAY = 300;

const NO_KEYBOARD_TYPES = new Set([
  'checkbox', 'radio', 'file', 'range', 'color', 'hidden', 'submit', 'reset', 'button', 'image',
]);

/**
 * Elements with this attribute keep the keyboard-open state alive even when
 * they receive focus themselves (e.g. a country-code dropdown trigger button
 * that is about to open a searchable list).
 */
const KEEP_KEYBOARD_ATTR = 'data-keyboard-keep';

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

    function clearBlurTimer() {
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
    }

    function isTextInput(el: HTMLElement): boolean {
      if (!el.matches(INPUT_SELECTOR)) return false;
      if (el instanceof HTMLInputElement && NO_KEYBOARD_TYPES.has(el.type)) return false;
      return true;
    }

    function onFocusIn(e: FocusEvent) {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      if (isTextInput(target)) {
        clearBlurTimer();
        setKeyboardOpen(true);
        return;
      }

      // If the focused element (or an ancestor) has data-keyboard-keep,
      // keep the keyboard state alive so chrome doesn't flash back during
      // transitions like phone-input → country-dropdown-search.
      if (isOpen && target.closest(`[${KEEP_KEYBOARD_ATTR}]`)) {
        clearBlurTimer();
      }
    }

    function onFocusOut() {
      clearBlurTimer();
      blurTimer = setTimeout(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && isTextInput(active)) return;
        if (active instanceof HTMLElement && active.closest(`[${KEEP_KEYBOARD_ATTR}]`)) return;
        setKeyboardOpen(false);
      }, BLUR_DELAY);
    }

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);

    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      clearBlurTimer();
      document.documentElement.classList.remove('keyboard-open');
    };
  }, []);
}
