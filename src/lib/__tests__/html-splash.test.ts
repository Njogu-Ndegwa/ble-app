import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dismissHtmlSplash, SPLASH_FADE_MS, SPLASH_SHOWN_KEY } from '../html-splash';

/**
 * Regression cover for the "stuck on the logo" bug: /signin rendered fine but
 * sat under the full-viewport #html-splash overlay forever, because only the
 * root page and the (mobile) layout ever removed it.
 *
 * The suite runs in vitest's `node` environment (see vitest.config.ts), so the
 * handful of DOM surfaces the helper touches are stubbed here rather than
 * pulling jsdom into the project for one file.
 */

interface StubElement {
  style: Record<string, string>;
}

let overlay: StubElement | null;
let store: Map<string, string>;
let storageThrows = false;

function mountOverlay(): StubElement {
  overlay = { style: {} };
  return overlay;
}

beforeEach(() => {
  vi.useFakeTimers();
  overlay = null;
  store = new Map();
  storageThrows = false;

  // window === globalThis so the helper's window.setTimeout picks up vi's fake
  // timers, which are installed on globalThis.
  (globalThis as Record<string, unknown>).window = globalThis;

  (globalThis as Record<string, unknown>).document = {
    getElementById: (id: string) => (id === 'html-splash' ? overlay : null),
  };

  (globalThis as Record<string, unknown>).sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (storageThrows) throw new Error('storage disabled');
      store.set(k, v);
    },
  };
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).document;
  delete (globalThis as Record<string, unknown>).sessionStorage;
  delete (globalThis as Record<string, unknown>).window;
});

describe('dismissHtmlSplash', () => {
  it('fades the overlay out and then removes it from the layout', () => {
    const el = mountOverlay();

    dismissHtmlSplash();

    expect(el.style.opacity).toBe('0');
    // Must stop swallowing clicks immediately, not only after the fade —
    // otherwise the sign-in form is visible but dead for 350ms.
    expect(el.style.pointerEvents).toBe('none');
    expect(el.style.display).toBeUndefined();

    vi.advanceTimersByTime(SPLASH_FADE_MS);
    expect(el.style.display).toBe('none');
  });

  it('records the splash as shown so the next page load skips it', () => {
    mountOverlay();
    dismissHtmlSplash();
    expect(store.get(SPLASH_SHOWN_KEY)).toBe('true');
  });

  it('leaves the flag alone when the caller owns the splash sequence', () => {
    mountOverlay();
    dismissHtmlSplash({ markShown: false });
    expect(store.has(SPLASH_SHOWN_KEY)).toBe(false);
  });

  it('is safe on a page with no overlay', () => {
    expect(() => dismissHtmlSplash()).not.toThrow();
    expect(store.get(SPLASH_SHOWN_KEY)).toBe('true');
  });

  it('is idempotent', () => {
    const el = mountOverlay();
    dismissHtmlSplash();
    dismissHtmlSplash();
    vi.advanceTimersByTime(SPLASH_FADE_MS);
    expect(el.style.display).toBe('none');
  });

  it('cancels the pending removal when the cleanup runs', () => {
    const el = mountOverlay();
    const cleanup = dismissHtmlSplash();

    cleanup();
    vi.advanceTimersByTime(SPLASH_FADE_MS * 2);

    // Unmounted before the fade finished, so the timer must not fire and touch
    // a node the next route may have replaced.
    expect(el.style.display).toBeUndefined();
  });

  it('still clears the overlay when storage is unavailable', () => {
    const el = mountOverlay();
    storageThrows = true;

    expect(() => dismissHtmlSplash()).not.toThrow();
    vi.advanceTimersByTime(SPLASH_FADE_MS);
    expect(el.style.display).toBe('none');
  });

  it('no-ops during server rendering', () => {
    delete (globalThis as Record<string, unknown>).document;
    expect(() => dismissHtmlSplash()).not.toThrow();
  });
});
