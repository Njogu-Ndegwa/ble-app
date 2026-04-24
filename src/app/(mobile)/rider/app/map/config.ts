/**
 * Shared map config for the rider app.
 *
 * Kept in a tiny dedicated module so both `RiderMap` (which loads the Maps
 * JS SDK via `<APIProvider>`) and `useRouting` (which calls the Routes REST
 * API directly) can pull the same API key without creating a circular
 * import between the map component and its hooks.
 *
 * The key is restricted in Google Cloud Console to this app's referrers and
 * to the specific APIs we use (Maps JavaScript API + Routes API). When it's
 * time to rotate it, change it in one place, here.
 */

export const MAPS_API_KEY = "AIzaSyDJ6octhDtaSW02NfWPn6NrxyMeNVB_IcU";

/**
 * Cloud-styled Map ID. Created via Google Cloud Console → Map Management →
 * Map IDs (JavaScript / Vector). Swapping it attaches a different cloud
 * style to the map without any code redeploy.
 */
export const MAP_ID = "634a14997c640edb8e36b1ce";
