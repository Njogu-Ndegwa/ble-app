/**
 * Keypad-only diagnostics. Filter DevTools console with: [Keypad]
 */
const PREFIX = "[Keypad]";

export function keypadLog(...args: unknown[]): void {
  // eslint-disable-next-line no-console -- intentional keypad diagnostics
  console.info(PREFIX, ...args);
}

export function keypadWarn(...args: unknown[]): void {
  console.warn(PREFIX, ...args);
}
