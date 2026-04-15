import { defaultCache } from "@serwist/next/worker";
import { Serwist, NetworkFirst, NetworkOnly } from "serwist";

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
      matcher: ({ request }) => request.destination === "document",
      handler: new NetworkFirst({
        cacheName: "pages-cache",
        networkTimeoutSeconds: 3,
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
