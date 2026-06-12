// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;


// import withSerwistInit from "@serwist/next";
 
// const withSerwist = withSerwistInit({
//   swSrc: "src/app/sw.js",
//   swDest: "public/sw.js",
// });
 
// export default withSerwist({});


const {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
} = require("next/constants");

/** @type {(phase: string, defaultConfig: import("next").NextConfig) => Promise<import("next").NextConfig>} */
module.exports = async (phase:any) => {
  /** @type {import("next").NextConfig} */
  const nextConfig = {};

  if (phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_BUILD) {
    const withSerwist = (await import("@serwist/next")).default({
      // Note: This is only an example. If you use Pages Router,
      // use something else that works, such as "service-worker/index.ts".
      swSrc: "src/app/sw.js",
      swDest: "public/sw.js",
      // Registration is deferred and done manually in ClientProviders: the
      // SW's install-time precache downloads every route's chunks, and on a
      // first launch those requests hog the connection pool exactly when the
      // user's first applet navigation needs it (measured: tap-to-open went
      // from 20s to <3s on Fast-3G by deferring registration ~12s).
      register: false,
    });
    return withSerwist(nextConfig);
  }

  return nextConfig;
};