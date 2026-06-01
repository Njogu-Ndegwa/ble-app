/**
 * All static SVG/image assets used by the SelectRole applet grid and hero.
 * Kept here so SplashScreen and SelectSA can start fetching them early —
 * before SelectRole mounts — eliminating the visible icon-pop-in on the grid.
 */
const ROLE_ICON_URLS = [
  '/assets/Customer.svg',
  '/assets/Products.svg',
  '/assets/Orders.svg',
  '/assets/Rider.svg',
  '/assets/Activator.svg',
  '/assets/Salesperson.svg',
  '/assets/Attendant2.svg',
  '/assets/Keypad2.svg',
  '/assets/BleDeviceAttendant.svg',
  '/assets/Bikes Oves.png',
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
