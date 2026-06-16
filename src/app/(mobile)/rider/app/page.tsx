import RiderApp from './RiderApp';

/**
 * Rider applet route. The full applet lives in `RiderApp` (a client component)
 * so route variants can reuse it verbatim — e.g. the Rider Basic applet at
 * `/rider-basic/app`, which renders the same component with `showTopUp={false}`
 * to drop the self-service energy Top-Up entry point.
 */
export default function RiderPage() {
  return <RiderApp />;
}
