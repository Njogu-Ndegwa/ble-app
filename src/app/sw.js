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


import { defaultCache } from "@serwist/next/worker";
import { Serwist, CacheFirst } from "serwist";

const serwist = new Serwist({
  precacheEntries: [
    ...self.__SW_MANIFEST,
    { url: "/offline.html", revision: "1" }, // Precache the offline page
  ],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      urlPattern: "/", // Cache the root URL with a cache-first strategy
      handler: new CacheFirst({
        cacheName: "app-shell",
      }),
    },
    ...defaultCache, // Preserve other default caching strategies
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline.html",
        matcher({ request }) {
          return request.destination === "document"; // Fallback for navigation requests
        },
      },
    ],
  },
});

serwist.addEventListeners();