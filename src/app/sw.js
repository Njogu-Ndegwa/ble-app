import { defaultCache } from "@serwist/next/worker";
import { Serwist, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from "serwist";

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
    ...defaultCache,
    {
      // Serve the app-shell HTML from cache immediately, revalidate in the
      // background. Since all app data is fetched client-side (no SSR data in
      // the HTML), stale HTML is always safe to display — the user never sees
      // outdated content. This eliminates the blank screen that NetworkFirst
      // caused while waiting up to 3 s for the server before showing anything.
      matcher: ({ request }) => request.destination === "document",
      handler: new StaleWhileRevalidate({
        cacheName: "pages-cache",
      }),
    },
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
