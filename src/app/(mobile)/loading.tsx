/**
 * Instant loading state for every applet route in the (mobile) group.
 *
 * Next.js shows this the moment a navigation into any applet starts, while
 * the route's JS chunks and RSC payload are still downloading. Without it the
 * previous screen stays frozen until the applet fully arrives — on a slow
 * first launch that reads as "nothing happened" and triggers rage clicks.
 */
export default function MobileSegmentLoading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70dvh',
        gap: 14,
      }}
    >
      <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
    </div>
  );
}
