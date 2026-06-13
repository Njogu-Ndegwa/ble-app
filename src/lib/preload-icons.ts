/**
 * All static SVG/image assets used by the SelectRole applet grid and hero.
 * Kept here so SplashScreen and SelectSA can start fetching them early —
 * before SelectRole mounts — eliminating the visible icon-pop-in on the grid.
 */
const ROLE_ICON_URLS = [
  '/assets/optimized/Customer.png',
  '/assets/optimized/Products.png',
  '/assets/optimized/Orders.png',
  '/assets/optimized/Rider.png',
  '/assets/optimized/Activator.png',
  '/assets/optimized/Salesperson.png',
  '/assets/optimized/Attendant2.png',
  '/assets/optimized/Keypad2.png',
  '/assets/optimized/BleDeviceAttendant.png',
  '/assets/optimized/Bikes Oves.png',
] as const;

let preloaded = false;

/**
 * Kick off browser fetches for every SelectRole icon asset so they land in the
 * HTTP/SW cache before the grid renders. Safe to call multiple times — only
 * fires once per page session.
 */
export function preloadRoleIcons(): void {
  if (typeof window === 'undefined' || preloaded) return;
  preloaded = true;
  for (const src of ROLE_ICON_URLS) {
    const img = new window.Image();
    img.src = src;
  }
}
