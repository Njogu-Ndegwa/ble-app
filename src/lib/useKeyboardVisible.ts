'use client';

import { useEffect } from 'react';

const KEYBOARD_THRESHOLD = 150;

/**
 * Detects mobile virtual keyboard visibility via the VisualViewport API.
 * Toggles `.keyboard-open` on <html> and sets `--vvh` CSS variable.
 * Hides non-essential fixed/sticky chrome (header, timeline, nav, action bar)
 * so the user has room to see and interact with input fields.
 */
export function useKeyboardVisible() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let isOpen = false;

    function onResize() {
      if (!vv) return;

      const diff = window.innerHeight - vv.height;
      const keyboardNow = diff > KEYBOARD_THRESHOLD;

      document.documentElement.style.setProperty('--vvh', `${Math.round(vv.height)}px`);

      if (keyboardNow === isOpen) return;
      isOpen = keyboardNow;

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

    vv.addEventListener('resize', onResize);
    onResize();

    return () => {
      vv.removeEventListener('resize', onResize);
      document.documentElement.classList.remove('keyboard-open');
      document.documentElement.style.removeProperty('--vvh');
    };
  }, []);
}
