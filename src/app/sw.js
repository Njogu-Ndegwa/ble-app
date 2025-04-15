import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";
 
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST, // Automatically precaches build assets
  skipWaiting: true, // Takes control immediately upon installation
  clientsClaim: true, // Claims clients immediately
  navigationPreload: true, // Enables navigation preloading if supported
  runtimeCaching: defaultCache, // Uses default caching strategies
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
 
serwist.addEventListeners(); // Registers event listeners for the service worker