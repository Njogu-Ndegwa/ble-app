'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { dismissHtmlSplash } from '@/lib/html-splash';

/**
 * Removes the server-rendered `#html-splash` overlay on every route that does
 * not manage it itself.
 *
 * Mounted once in the root layout. Before this existed the overlay was only
 * taken down by `src/app/page.tsx` (the root splash sequence) and the
 * `(mobile)` layout, so any route outside those — `/signin`, the 404 page, and
 * any future route group — stayed hidden behind the logo permanently. The
 * boot watchdog in layout.tsx could not rescue it either: the app really had
 * booted, so `__appBooted` was set and the watchdog correctly stood down.
 *
 * Handling it at the root means a new route group cannot reintroduce the bug
 * by forgetting to opt in.
 */

/**
 * Longest the overlay may stay up on `/` before we assume the splash sequence
 * has stalled and pull it down regardless. Comfortably clear of the ~1.2s
 * animation plus the <=1.5s service-worker wait that precedes it.
 */
const STUCK_MS = 6000;

export default function DismissHtmlSplash() {
  const pathname = usePathname();

  useEffect(() => {
    // `/` owns the overlay: SplashScreen crossfades from it into the animated
    // splash and removes it when that finishes. Taking it down here would cut
    // the animation short.
    if (pathname !== '/') return dismissHtmlSplash();

    // Safety net for `/`: never strand the user on a logo with no way out.
    const id = window.setTimeout(() => dismissHtmlSplash(), STUCK_MS);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return null;
}
