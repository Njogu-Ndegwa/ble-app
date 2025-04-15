// import { defaultCache } from "@serwist/next/worker";
// import { Serwist } from "serwist";
 
// const serwist = new Serwist({
//   precacheEntries: self.__SW_MANIFEST, // Automatically precaches build assets
//   skipWaiting: true, // Takes control immediately upon installation
//   clientsClaim: true, // Claims clients immediately
//   navigationPreload: true, // Enables navigation preloading if supported
//   runtimeCaching: defaultCache, // Uses default caching strategies
//   fallbacks: {
//     entries: [
//       {
//         url: "/offline.html",
//         matcher({ request }) {
//           return request.destination === "document"; // Fallback for navigation requests
//         },
//       },
//     ],
//   },
// });
 
// serwist.addEventListeners(); // Registers event listeners for the service worker


// import { defaultCache } from "@serwist/next/worker";
// import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
// import { Serwist } from "serwist";

// // This declares the value of `injectionPoint` to TypeScript.
// // `injectionPoint` is the string that will be replaced by the
// // actual precache manifest. By default, this string is set to
// // `"self.__SW_MANIFEST"`.
// declare global {
//   interface WorkerGlobalScope extends SerwistGlobalConfig {
//     __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
//   }
// }

// declare const self: ServiceWorkerGlobalScope;

// const serwist = new Serwist({
//   precacheEntries: self.__SW_MANIFEST,
//   skipWaiting: true,
//   clientsClaim: true,
//   navigationPreload: true,
//   runtimeCaching: defaultCache,
// });

// serwist.addEventListeners();


// import { defaultCache } from "@serwist/next/worker";
// import { Serwist, NetworkFirst } from "serwist"; // Import NetworkFirst

// const serwist = new Serwist({
//   precacheEntries: self.__SW_MANIFEST,
//   skipWaiting: true,
//   clientsClaim: true,
//   navigationPreload: true,
//   runtimeCaching: [
//     ...defaultCache,
//     {
//       matcher: ({ request }) => request.destination === "document",
//       handler: new NetworkFirst({
//         cacheName: "pages-cache",
//         networkTimeoutSeconds: 3,
//       }),
//     },
//   ],
//   fallbacks: {
//     entries: [
//       {
//         url: "/offline.html",
//         matcher({ request }) {
//           return request.destination === "document";
//         },
//       },
//     ],
//   },
// });

// serwist.addEventListeners();



import { defaultCache } from "@serwist/next/worker";
import { Serwist, NetworkFirst } from "serwist";

const serwist = new Serwist({
  precacheEntries: [
    ...self.__SW_MANIFEST,
    // Explicitly precache the root page
    { url: "/", revision: "CACHE_ROOT_HACK" },
  ],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
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

// Force-cache root page during installation
serwist.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("pages-cache").then(cache => cache.add("/"))
  );
});

serwist.addEventListeners();