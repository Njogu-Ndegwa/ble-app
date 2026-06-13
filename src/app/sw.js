import { defaultCache } from "@serwist/next/worker";
import {
  Serwist,
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  StaleWhileRevalidate,
} from "serwist";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // OAuth callbacks must ALWAYS hit the network — never serve stale cache
    {
      matcher: ({ url, request }) =>
        request.destination === "document" && url.searchParams.has("token"),
      handler: new NetworkOnly(),
    },

    // App-shell HTML: serve from cache instantly, revalidate in the background.
    // This MUST come before ...defaultCache — defaultCache ends with a catch-all
    // NetworkFirst that otherwise grabs every navigation and forces first paint
    // to wait on the network. Since all data is fetched client-side, stale HTML
    // is always safe to show; the user never sees outdated content.
    {
      matcher: ({ request }) => request.destination === "document",
      handler: new StaleWhileRevalidate({ cacheName: "pages-cache" }),
    },

    // Build assets (/_next/static/**: hashed JS, CSS, fonts) are immutable —
    // their filename changes whenever their contents do, so a cached copy can
    // NEVER be stale. Cache them permanently. This is the core cold-start fix:
    // defaultCache caps these at 24h, so after a day idle the app's own code
    // was purged, and a cold-network launch then hung on the bare logo with no
    // script left to hydrate React. Bounded by entry count (several builds'
    // worth) rather than age so an idle install never loses its shell.
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "next-static-immutable",
        plugins: [new ExpirationPlugin({ maxEntries: 250 })],
      }),
    },

    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline.html",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
