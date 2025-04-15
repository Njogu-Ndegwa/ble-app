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
    // Precache root page with proper revision
    { url: "/", revision: process.env.SOURCE_VERSION || "CACHE_ROOT_HACK" },
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

// Modified install handler with proper error handling
serwist.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("pages-cache")
      .then(cache => {
        return fetch("/")
          .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return cache.put("/", response);
          })
          .catch(() => {
            // If network fails, check if we have a fallback
            return cache.match("/").then(existing => {
              if (!existing) return cache.add("/offline.html");
            });
          });
      })
      .catch(error => {
        console.error("Cache installation failed:", error);
        // Still allow service worker to install
        return Promise.resolve();
      })
  );
});

serwist.addEventListeners();