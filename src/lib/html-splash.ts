/**
 * Teardown for the `#html-splash` overlay.
 *
 * The overlay is server-rendered by the root layout (`src/app/layout.tsx`) on
 * *every* route: a fixed, full-viewport element at z-index 9999 showing the
 * Oves logo. It exists so a cold start shows branding instead of a white page
 * while the JS bundle loads.
 *
 * Nothing in the static markup can ever take it down — only client code can.
 * That makes removing it a correctness requirement, not a nicety: any route
 * that fails to call this renders perfectly well and stays completely
 * invisible, which reads to the user as "the page is stuck loading".
 *
 * Keep the teardown here so every caller does it the same way.
 */

/** Matches `transition:opacity .3s` on #html-splash, plus a little slack. */
export const SPLASH_FADE_MS = 350;

/**
 * Set once the overlay has been taken down. The inline script in layout.tsx
 * reads it on the next navigation and hides the overlay before first paint,
 * which is what stops the logo flashing between pages in the same tab.
 *
 * Note this is sessionStorage, so it is per-tab: opening the app in a second
 * tab starts again with no flag.
 */
export const SPLASH_SHOWN_KEY = 'oves-splash-shown';

interface DismissOptions {
  /**
   * Whether to record that the splash has been shown for this tab. Defaults to
   * true. The root page's animated SplashScreen passes false: it takes the
   * overlay down at the *start* of its animation and only counts the splash as
   * shown once the animation finishes, so a reload part-way through still
   * plays it.
   */
  markShown?: boolean;
}

/**
 * Fade out and remove the overlay. Safe to call repeatedly, on any route, and
 * during SSR (where it is a no-op).
 *
 * Returns a cleanup that cancels the pending `display:none` timer, so it can be
 * returned directly from a `useEffect`.
 */
export function dismissHtmlSplash({ markShown = true }: DismissOptions = {}): () => void {
  const noop = () => {};
  if (typeof document === 'undefined') return noop;

  if (markShown) {
    try {
      sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
    } catch {
      /* private mode / storage disabled — the overlay still comes down below */
    }
  }

  const el = document.getElementById('html-splash');
  if (!el) return noop;

  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  const id = window.setTimeout(() => {
    el.style.display = 'none';
  }, SPLASH_FADE_MS);

  return () => window.clearTimeout(id);
}
