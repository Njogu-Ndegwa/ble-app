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

/**
 * Minimum viewport height increase (px) that signals the keyboard was
 * dismissed while an input still has focus (e.g. Android back-arrow or
 * iOS swipe-down). Set below the smallest keyboard height (~200px on
 * compact devices) but above URL-bar fluctuations (~60px).
 */
const VIEWPORT_GROW_THRESHOLD = 100;

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
 * Detects mobile virtual keyboard visibility using two complementary signals:
 *
 * 1. **focusin / focusout** (primary) — toggles `.keyboard-open` when a
 *    text-entry input gains or loses focus. Works on every mobile browser.
 *
 * 2. **VisualViewport resize** (secondary) — catches the edge case where
 *    the user dismisses the keyboard without blurring the input (Android
 *    dismiss arrow, iOS swipe-down). When the viewport height grows back
 *    significantly while we think the keyboard is open, we know it was
 *    dismissed and remove `.keyboard-open`.
 */
export function useKeyboardVisible() {
  useEffect(() => {
    const vv = window.visualViewport;

    let blurTimer: ReturnType<typeof setTimeout> | null = null;
    let isOpen = false;
    /** Viewport height recorded when keyboard opened; used by the
     *  VisualViewport watcher to detect keyboard dismiss without blur. */
    let heightAtOpen = 0;

    function setKeyboardOpen(open: boolean) {
      if (open === isOpen) return;
      isOpen = open;
      document.documentElement.classList.toggle('keyboard-open', isOpen);

      if (isOpen) {
        // Snapshot the viewport height so we can detect a later grow-back.
        heightAtOpen = vv ? vv.height : window.innerHeight;

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

    // ---- Primary: focus tracking ----

    function onFocusIn(e: FocusEvent) {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      if (isTextInput(target)) {
        clearBlurTimer();
        setKeyboardOpen(true);
        return;
      }

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

    // ---- Secondary: VisualViewport resize ----
    // Catches keyboard dismiss without blur (Android arrow / iOS swipe).

    function onViewportResize() {
      if (!isOpen || !vv) return;

      const grew = vv.height - heightAtOpen;
      if (grew > VIEWPORT_GROW_THRESHOLD) {
        setKeyboardOpen(false);
      }
    }

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    vv?.addEventListener('resize', onViewportResize);

    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      vv?.removeEventListener('resize', onViewportResize);
      clearBlurTimer();
      document.documentElement.classList.remove('keyboard-open');
    };
  }, []);
}
